const express = require("express");
const Task = require("../models/Task");
const TaskUpdate = require("../models/TaskUpdate");
const TaskReview = require("../models/TaskReview");
const User = require("../models/User");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/auth");
const { getEffectiveSubordinateIds, canUserApproveTask, requirePermission } = require("../middleware/rbac");

const router = express.Router();

// GET /api/tasks - Hierarchical & scope-filtered task list (strict multi-company isolation)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;
    const orgId = currentUser.organizationId;

    // Base query ALWAYS ensures multi-company isolation
    let query = { organizationId: orgId };

    const taskScope = currentUser.accessScopes?.taskScope || (
      currentUser.role === "admin"
        ? "company"
        : currentUser.role === "director"
        ? "project"
        : currentUser.role === "manager"
        ? "team"
        : "own"
    );

    if (currentUser.role !== "admin" && taskScope !== "company") {
      if (taskScope === "department" && currentUser.department) {
        // Find users in same department
        const deptUsers = await User.find({ organizationId: orgId, department: currentUser.department }).select("_id");
        const deptUserIds = deptUsers.map((u) => u._id);
        query.$or = [
          { department: currentUser.department },
          { assignedTo: { $in: deptUserIds } },
          { assignedBy: { $in: deptUserIds } },
        ];
      } else if (taskScope === "team" && currentUser.team) {
        // Find users in same team
        const teamUsers = await User.find({ organizationId: orgId, team: currentUser.team }).select("_id");
        const teamUserIds = teamUsers.map((u) => u._id);
        query.$or = [
          { team: currentUser.team },
          { assignedTo: { $in: teamUserIds } },
          { assignedBy: { $in: teamUserIds } },
        ];
      } else if (taskScope === "project") {
        // Director / project scope: tasks under user's projects or assigned to/by user
        const directorProjects = await Project.find({
          organizationId: orgId,
          $or: [{ directorId: currentUser.id }, { createdBy: currentUser.id }],
        }).select("_id");
        const projectIds = directorProjects.map((p) => p._id);

        const subordinateIds = await getEffectiveSubordinateIds(currentUser.id, orgId);

        query.$or = [
          { projectId: { $in: projectIds } },
          { assignedBy: currentUser.id },
          { assignedTo: currentUser.id },
          { assignedTo: { $in: subordinateIds } },
        ];
      } else {
        // "own" scope: assigned to user, assigned by user, or assigned to subordinates
        const subordinateIds = await getEffectiveSubordinateIds(currentUser.id, orgId);

        query.$or = [
          { assignedTo: currentUser.id },
          { assignedBy: currentUser.id },
          { user: currentUser.id },
          { assignedTo: { $in: subordinateIds } },
        ];
      }
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "firstName lastName email designation role department team")
      .populate("assignedBy", "firstName lastName email role")
      .populate("projectId", "name deadline status priority")
      .populate("parentTaskId", "title")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("Fetch tasks error:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/tasks - Create task or subtask with RBAC and company isolation
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    // RBAC permission check
    const canCreate = user.role === "admin" || user.permissions?.canCreateTasks || user.permissions?.canAssignTasks;
    if (!canCreate) {
      return res.status(403).json({ message: "Access denied. You do not have permission to create or assign tasks." });
    }

    const {
      title,
      description,
      projectId,
      parentTaskId,
      assignedTo,
      deadline,
      dueDate,
      priority,
      weight,
      status,
      department,
      team,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Task title is required." });
    }

    let assignedToUser = null;
    let assignedToName = "Unassigned";

    if (assignedTo) {
      // Must belong to the same company
      assignedToUser = await User.findOne({ _id: assignedTo, organizationId: orgId });
      if (!assignedToUser) {
        return res.status(400).json({ message: "Assignee not found in your organization." });
      }
      assignedToName = `${assignedToUser.firstName} ${assignedToUser.lastName}`;
    }

    // Verify projectId belongs to this organization
    if (projectId) {
      const proj = await Project.findOne({ _id: projectId, organizationId: orgId });
      if (!proj) {
        return res.status(400).json({ message: "Specified project does not belong to your organization." });
      }
    }

    const assignedByName = `${user.firstName || "Supervisor"} ${user.lastName || ""}`.trim();

    const task = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      organizationId: orgId,
      department: department ? department.trim() : (assignedToUser?.department || user.department || "General"),
      team: team ? team.trim() : (assignedToUser?.team || user.team || ""),
      projectId: projectId || null,
      parentTaskId: parentTaskId || null,
      assignedTo: assignedToUser ? assignedToUser._id : null,
      assignedToName,
      assignedBy: user.id,
      assignedByName,
      deadline: deadline || dueDate || "",
      dueDate: dueDate || deadline || "",
      priority: priority || "medium",
      weight: weight ? Number(weight) : 1,
      status: status || "not-started",
      progress: status === "completed" ? 100 : 0,
      user: user.id,
    });

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "firstName lastName email designation role")
      .populate("assignedBy", "firstName lastName email role")
      .populate("projectId", "name deadline status");

    res.status(201).json({
      message: "Task successfully created and assigned",
      task: populated,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(400).json({ message: error.message });
  }
});

// PATCH /api/tasks/:id/progress - Employee updates progress %, status, and blockers
router.patch("/:id/progress", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your organization." });
    }

    const { progress, status, blocker, comment } = req.body;
    const oldStatus = task.status;

    if (progress !== undefined) {
      task.progress = Math.min(100, Math.max(0, Number(progress)));
    }
    if (status) {
      task.status = status;
    }
    if (blocker !== undefined) {
      task.blocker = blocker.trim();
    }

    if (task.progress === 100 && task.status === "in-progress") {
      task.status = "submitted";
    }

    await task.save();

    await TaskUpdate.create({
      taskId: task._id,
      updatedBy: req.user.id,
      updatedByName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
      oldStatus,
      newStatus: task.status,
      progress: task.progress,
      comment: comment ? comment.trim() : "",
      blocker: task.blocker,
    });

    res.json({ message: "Progress updated successfully", task });
  } catch (error) {
    console.error("Progress update error:", error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/tasks/:id/submit - Employee submits deliverable for review
router.post("/:id/submit", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your organization." });
    }

    const { submissionNotes } = req.body;
    task.status = "submitted";
    task.progress = 100;
    if (submissionNotes) {
      task.submissionNotes = submissionNotes.trim();
    }
    await task.save();

    await TaskUpdate.create({
      taskId: task._id,
      updatedBy: req.user.id,
      updatedByName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
      oldStatus: "in-progress",
      newStatus: "submitted",
      progress: 100,
      comment: submissionNotes || "Submitted work for review",
    });

    res.json({ message: "Work submitted for review successfully", task });
  } catch (error) {
    console.error("Submit task error:", error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/tasks/:id/review - Supervisor approves or requests changes (RBAC enforced)
router.post("/:id/review", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your organization." });
    }

    // Check approval permission across role, scopes, and reporting relationships
    const canApprove = await canUserApproveTask(req.user, task.assignedTo, orgId);
    if (!canApprove) {
      return res.status(403).json({
        message: "Access denied. You do not have permission or supervisory relationship to approve this task.",
      });
    }

    const { decision, feedback } = req.body; // "approved" | "changes_requested"
    if (!decision || !["approved", "changes_requested"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'changes_requested'." });
    }

    const reviewerName = `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim();

    if (decision === "approved") {
      task.status = "completed";
      task.progress = 100;
      task.reviewFeedback = feedback ? feedback.trim() : "Approved by supervisor.";
      task.reviewedBy = req.user.id;
      task.reviewedAt = new Date();
    } else {
      task.status = "in-progress"; // Returned for revision
      task.progress = Math.min(task.progress, 80);
      task.reviewFeedback = feedback ? feedback.trim() : "Changes requested by supervisor.";
      task.reviewedBy = req.user.id;
      task.reviewedAt = new Date();
    }

    await task.save();

    await TaskReview.create({
      taskId: task._id,
      reviewerId: req.user.id,
      reviewerName,
      decision,
      feedback: task.reviewFeedback,
    });

    res.json({
      message: decision === "approved" ? "Work approved successfully" : "Returned to subordinate for revision",
      task,
    });
  } catch (error) {
    console.error("Review task error:", error);
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/tasks/:id - Update task details (RBAC enforced)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your organization." });
    }

    // Check permission to edit
    const isAssignee = task.assignedTo && task.assignedTo.toString() === user.id.toString();
    const isAssigner = task.assignedBy && task.assignedBy.toString() === user.id.toString();
    const hasPerm = user.role === "admin" || user.permissions?.canEditTasks || isAssigner || isAssignee;

    if (!hasPerm) {
      return res.status(403).json({ message: "Access denied. You do not have permission to edit this task." });
    }

    const { title, description, status, priority, dueDate, deadline, assignedTo, weight, department, team } = req.body;

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (deadline !== undefined) task.deadline = deadline;
    if (weight !== undefined) task.weight = Number(weight);
    if (department !== undefined) task.department = department.trim();
    if (team !== undefined) task.team = team.trim();

    if (assignedTo !== undefined) {
      if (assignedTo) {
        const u = await User.findOne({ _id: assignedTo, organizationId: orgId });
        if (!u) {
          return res.status(400).json({ message: "Assignee does not belong to your organization." });
        }
        task.assignedTo = u._id;
        task.assignedToName = `${u.firstName} ${u.lastName}`;
      } else {
        task.assignedTo = null;
        task.assignedToName = "Unassigned";
      }
    }

    await task.save();
    res.json({ message: "Task updated successfully", task });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/tasks/:id - Delete task and its subtasks (RBAC enforced)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your organization." });
    }

    const hasPerm = user.role === "admin" || user.permissions?.canDeleteTasks || (task.assignedBy && task.assignedBy.toString() === user.id.toString());
    if (!hasPerm) {
      return res.status(403).json({ message: "Access denied. You do not have permission to delete this task." });
    }

    await Task.deleteMany({ parentTaskId: task._id, organizationId: orgId });
    await Task.findByIdAndDelete(task._id);

    res.json({ message: "Task and subtasks deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
