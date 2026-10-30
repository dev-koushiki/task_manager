const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const TaskUpdate = require("../models/TaskUpdate");
const TaskReview = require("../models/TaskReview");
const User = require("../models/User");
const Project = require("../models/Project");
const Organization = require("../models/Organization");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");
const { getEffectiveSubordinateIds, canUserApproveTask } = require("../middleware/rbac");

const router = express.Router();

// Helper to check if assigner is authorized to assign task to assignee
async function isAuthorizedToAssign(assigner, assigneeUser, parentTaskId, orgId) {
  if (assigner.role === "admin") return true;
  if (!assigneeUser) return true; // Unassigned task

  const assignerIdStr = assigner.id.toString();
  const assigneeIdStr = assigneeUser._id.toString();

  // 1. Assign to self
  if (assignerIdStr === assigneeIdStr) return true;

  // Assigner must have assignment permission to assign tasks to other employees
  const hasAssignPerm = Boolean(
    assigner.permissions?.canAssignTasks ||
    assigner.permissions?.canCreateTasks ||
    assigner.role === "admin"
  );
  if (!hasAssignPerm) {
    return false; // Interns/freshers without assignment permission cannot assign tasks
  }

  // 2. Check reporting subordinates from organizational tree
  try {
    const org = await Organization.findById(orgId);
    if (org && Array.isArray(org.treeNodes) && org.treeNodes.length > 0) {
      // Find node occupied by assigner
      const assignerNode = org.treeNodes.find(
        (n) => n.employeeId && n.employeeId.toString() === assignerIdStr
      );
      if (assignerNode) {
        // Collect all descendant nodes in the tree
        const descendantEmployeeIds = new Set();
        const queue = [assignerNode.id];
        while (queue.length > 0) {
          const currentParentId = queue.shift();
          const children = org.treeNodes.filter((n) => n.parentId === currentParentId);
          for (const ch of children) {
            queue.push(ch.id);
            if (ch.employeeId) {
              descendantEmployeeIds.add(ch.employeeId.toString());
            }
          }
        }
        if (descendantEmployeeIds.has(assigneeIdStr)) {
          return true;
        }
      }
    }
  } catch (err) {
    console.error("Error checking tree reporting relationship:", err);
  }

  // 3. Fallback check: subordinates via reportsTo / reportingRelationships
  const subordinateIds = await getEffectiveSubordinateIds(assigner.id, orgId);
  const isSubordinate = subordinateIds.some((id) => id.toString() === assigneeIdStr);
  if (isSubordinate) return true;

  // 4. Subtask delegation on parent tasks assigned to the user
  if (parentTaskId) {
    const parentTask = await Task.findOne({ _id: parentTaskId, organizationId: orgId });
    if (parentTask) {
      const isParentAssignee = parentTask.assignedTo && parentTask.assignedTo.toString() === assignerIdStr;
      const isParentAssigner = parentTask.assignedBy && parentTask.assignedBy.toString() === assignerIdStr;
      if (isParentAssignee || isParentAssigner) {
        return true;
      }
    }
  }

  return false;
}

// GET /api/tasks/authorized-assignees - List of employees current user can assign tasks to
router.get("/authorized-assignees", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    if (user.role === "admin") {
      const allActive = await User.find({ organizationId: orgId, status: "active" })
        .select("firstName lastName email role designation department positionTitle employeeId");
      return res.json(allActive);
    }

    const hasAssignPerm = Boolean(
      user.permissions?.canAssignTasks || user.permissions?.canCreateTasks
    );

    if (!hasAssignPerm) {
      // Intern or fresher without assignment permission
      return res.json([]);
    }

    // Dynamic calculation from tree
    const targetUserIds = new Set();
    const org = await Organization.findById(orgId);
    if (org && Array.isArray(org.treeNodes) && org.treeNodes.length > 0) {
      const userNode = org.treeNodes.find(
        (n) => n.employeeId && n.employeeId.toString() === user.id.toString()
      );
      if (userNode) {
        const queue = [userNode.id];
        while (queue.length > 0) {
          const currentParentId = queue.shift();
          const children = org.treeNodes.filter((n) => n.parentId === currentParentId);
          for (const ch of children) {
            queue.push(ch.id);
            if (ch.employeeId) {
              targetUserIds.add(ch.employeeId.toString());
            }
          }
        }
      }
    }

    // Also include subordinates via reporting relationships
    const subIds = await getEffectiveSubordinateIds(user.id, orgId);
    subIds.forEach((id) => targetUserIds.add(id.toString()));

    if (targetUserIds.size === 0) {
      return res.json([]);
    }

    const authorizedUsers = await User.find({
      organizationId: orgId,
      _id: { $in: Array.from(targetUserIds) },
      status: "active",
    }).select("firstName lastName email role designation department positionTitle employeeId");

    res.json(authorizedUsers);
  } catch (error) {
    console.error("Error fetching authorized assignees:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/tasks - Reporting-based task listing (strict multi-company data isolation)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;
    const orgId = currentUser.organizationId;

    let query = { organizationId: orgId };

    const isAdmin = currentUser.role === "admin";
    const perms = currentUser.permissions || {};
    const taskScope = currentUser.accessScopes?.taskScope || (isAdmin ? "company" : "own");

    if (!isAdmin && taskScope !== "company" && !perms.canViewAllTasks) {
      // Find all direct & indirect subordinates in the reporting tree
      const subordinateIds = await getEffectiveSubordinateIds(currentUser.id, orgId);

      // Tasks where currentUser is the parent task assignee (for monitoring subtasks delegated to team)
      const managedParentTasks = await Task.find({
        organizationId: orgId,
        $or: [{ assignedTo: currentUser.id }, { assignedBy: currentUser.id }, { user: currentUser.id }],
      }).select("_id");
      const parentTaskIds = managedParentTasks.map((t) => t._id);

      const visibilityConditions = [
        { assignedTo: currentUser.id },
        { assignedBy: currentUser.id },
        { user: currentUser.id },
        { assignedTo: { $in: subordinateIds } },
        { parentTaskId: { $in: parentTaskIds } },
      ];

      // Relevant team / department visibility if authorized
      if (perms.canViewTeamTasks || taskScope === "team") {
        if (currentUser.team) {
          const teamUsers = await User.find({ organizationId: orgId, team: currentUser.team }).select("_id");
          const teamUserIds = teamUsers.map((u) => u._id);
          visibilityConditions.push({ team: currentUser.team });
          visibilityConditions.push({ assignedTo: { $in: teamUserIds } });
        }
      }

      if (taskScope === "department") {
        if (currentUser.department) {
          const deptUsers = await User.find({ organizationId: orgId, department: currentUser.department }).select("_id");
          const deptUserIds = deptUsers.map((u) => u._id);
          visibilityConditions.push({ department: currentUser.department });
          visibilityConditions.push({ assignedTo: { $in: deptUserIds } });
        }
      }

      query.$or = visibilityConditions;
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "firstName lastName email designation positionTitle role department team")
      .populate("assignedBy", "firstName lastName email role designation positionTitle")
      .populate("projectId", "name deadline status priority")
      .populate("parentTaskId", "title")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("Fetch tasks error:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/tasks - Create task or subtask with hierarchical reporting and delegation
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

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
        return res.status(400).json({ message: "Assignee not found in your company." });
      }
      assignedToName = `${assignedToUser.firstName} ${assignedToUser.lastName}`;

      // Prevent unauthorized task assignments
      const authorized = await isAuthorizedToAssign(user, assignedToUser, parentTaskId, orgId);
      if (!authorized) {
        return res.status(403).json({
          message: "Unauthorized task assignment: You can only assign tasks to your team members, subordinates, or yourself.",
        });
      }
    }

    // Verify projectId belongs to this company
    if (projectId) {
      const proj = await Project.findOne({ _id: projectId, organizationId: orgId });
      if (!proj) {
        return res.status(400).json({ message: "Specified project does not belong to your company." });
      }
    }

    const assignedByName = `${user.firstName || "Supervisor"} ${user.lastName || ""}`.trim();

    let sanitizedMilestones = [];
    if (Array.isArray(req.body.milestones)) {
      sanitizedMilestones = req.body.milestones
        .map((m) => {
          if (typeof m === "string") {
            const trimmed = m.trim();
            return trimmed ? { id: new mongoose.Types.ObjectId().toString(), title: trimmed, completed: false } : null;
          }
          if (m && typeof m === "object" && m.title) {
            return {
              id: m.id || new mongoose.Types.ObjectId().toString(),
              title: m.title.trim(),
              completed: Boolean(m.completed),
              completedAt: m.completedAt || null,
              completedBy: m.completedBy || null,
              completedByName: m.completedByName || "",
            };
          }
          return null;
        })
        .filter(Boolean);
    }

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
      milestones: sanitizedMilestones,
    });

    if (assignedToUser && assignedToUser._id.toString() !== user.id.toString()) {
      await Notification.create({
        userId: assignedToUser._id,
        organizationId: orgId,
        type: "task_assigned",
        title: "New Task Assigned",
        message: `${assignedByName} assigned you: "${task.title}".`,
        link: `/tasks/${task._id}`,
        metadata: { taskId: task._id, assignedBy: user.id },
      });
    }

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "firstName lastName email designation positionTitle role")
      .populate("assignedBy", "firstName lastName email role")
      .populate("projectId", "name deadline status");

    res.status(201).json({
      message: parentTaskId ? "Subtask delegated successfully" : "Task created and assigned successfully",
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
      return res.status(404).json({ message: "Task not found in your company." });
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

// POST /api/tasks/:id/submit - Employee submits deliverable for manager review
router.post("/:id/submit", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your company." });
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

    // Notify reporting person
    let supervisorId = task.assignedBy;
    if (!supervisorId && req.user.reportsTo) {
      supervisorId = req.user.reportsTo;
    }
    if (supervisorId && supervisorId.toString() !== req.user.id.toString()) {
      await Notification.create({
        userId: supervisorId,
        organizationId: orgId,
        type: "general",
        title: "Work Submitted for Review",
        message: `${req.user.firstName || "Employee"} ${req.user.lastName || ""} submitted deliverable for "${task.title}".`,
        link: `/tasks/${task._id}`,
        metadata: { taskId: task._id, submittedBy: req.user.id },
      });
    }

    res.json({ message: "Work submitted for review successfully", task });
  } catch (error) {
    console.error("Submit task error:", error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/tasks/:id/review - Manager approves or requests changes
router.post("/:id/review", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your company." });
    }

    // Check review authorization: Admin, Task Assigner, Assignee's manager, or authorized approver
    const isAssigner = task.assignedBy && task.assignedBy.toString() === req.user.id.toString();
    const canApprove = isAssigner || (await canUserApproveTask(req.user, task.assignedTo, orgId));

    if (!canApprove) {
      return res.status(403).json({
        message: "Access denied. You do not have permission or a managerial relationship to approve this work.",
      });
    }

    const { decision, feedback } = req.body;
    if (!decision || !["approved", "changes_requested"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'changes_requested'." });
    }

    const reviewerName = `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim();

    if (decision === "approved") {
      task.status = "completed";
      task.progress = 100;
      task.reviewFeedback = feedback ? feedback.trim() : "Approved by manager.";
      task.reviewedBy = req.user.id;
      task.reviewedAt = new Date();
    } else {
      task.status = "in-progress";
      task.progress = Math.min(task.progress, 80);
      task.reviewFeedback = feedback ? feedback.trim() : "Changes requested by manager.";
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

    if (task.assignedTo && task.assignedTo.toString() !== req.user.id.toString()) {
      await Notification.create({
        userId: task.assignedTo,
        organizationId: orgId,
        type: "general",
        title: decision === "approved" ? "Work Approved!" : "Changes Requested",
        message:
          decision === "approved"
            ? `Your deliverable for "${task.title}" was approved by ${reviewerName}.`
            : `${reviewerName} requested changes for "${task.title}": ${task.reviewFeedback}`,
        link: `/tasks/${task._id}`,
        metadata: { taskId: task._id, decision, reviewerId: req.user.id },
      });
    }

    res.json({
      message: decision === "approved" ? "Work approved successfully" : "Returned to team member for revision",
      task,
    });
  } catch (error) {
    console.error("Review task error:", error);
    res.status(400).json({ message: error.message });
  }
});

// ======================== MILESTONE MANAGEMENT ========================

// PATCH & POST /api/tasks/:id/milestones/:milestoneId/complete - Complete an independent milestone
const handleCompleteMilestone = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your company." });
    }

    const milestoneId = req.params.milestoneId;
    const milestone = task.milestones.find(
      (m) => m.id === milestoneId || (m._id && m._id.toString() === milestoneId)
    );

    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found in this task." });
    }

    const now = new Date();
    const employeeName = `${req.user.firstName || "Team Member"} ${req.user.lastName || ""}`.trim();

    milestone.completed = true;
    milestone.completedAt = now;
    milestone.completedBy = req.user.id;
    milestone.completedByName = employeeName;

    // Recalculate progress based on completed milestones
    const totalCount = task.milestones.length;
    const completedCount = task.milestones.filter((m) => m.completed).length;
    const calculatedProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : task.progress;

    const oldStatus = task.status;
    task.progress = calculatedProgress;
    if (task.progress === 100 && task.status !== "completed") {
      task.status = "submitted";
    } else if (task.progress > 0 && task.status === "not-started") {
      task.status = "in-progress";
    }

    task.markModified("milestones");
    await task.save();

    // Create activity update
    await TaskUpdate.create({
      taskId: task._id,
      updatedBy: req.user.id,
      updatedByName: employeeName,
      oldStatus,
      newStatus: task.status,
      progress: task.progress,
      comment: `Completed milestone: "${milestone.title}"`,
    });

    // Notify reporting person
    let supervisorId = task.assignedBy;
    if (!supervisorId && req.user.reportsTo) {
      supervisorId = req.user.reportsTo;
    }
    if (supervisorId && supervisorId.toString() !== req.user.id.toString()) {
      await Notification.create({
        userId: supervisorId,
        organizationId: orgId,
        type: "general",
        title: "Milestone Completed",
        message: `${employeeName} completed milestone "${milestone.title}" on task "${task.title}".`,
        link: `/tasks/${task._id}`,
        metadata: {
          taskId: task._id,
          milestoneId: milestone.id || milestone._id,
          completedBy: req.user.id,
          completedAt: now,
        },
      });
    }

    res.json({
      message: `Milestone "${milestone.title}" marked as completed.`,
      task,
      milestone,
    });
  } catch (error) {
    console.error("Complete milestone error:", error);
    res.status(500).json({ message: error.message });
  }
};

router.patch("/:id/milestones/:milestoneId/complete", authMiddleware, handleCompleteMilestone);
router.post("/:id/milestones/:milestoneId/complete", authMiddleware, handleCompleteMilestone);

// POST /api/tasks/:id/milestones - Add new milestone to task
router.post("/:id/milestones", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Milestone title is required." });
    }

    const orgId = req.user.organizationId;
    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    const newMilestone = {
      id: new mongoose.Types.ObjectId().toString(),
      title: title.trim(),
      completed: false,
      completedAt: null,
      completedBy: null,
      completedByName: "",
    };

    task.milestones.push(newMilestone);
    task.markModified("milestones");
    await task.save();

    res.status(201).json({
      message: "Milestone added successfully",
      task,
      milestone: newMilestone,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/tasks/:id - Update task details with authorization check
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your company." });
    }

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

    if (Array.isArray(req.body.milestones)) {
      task.milestones = req.body.milestones
        .map((m) => {
          if (typeof m === "string") {
            const trimmed = m.trim();
            return trimmed ? { id: new mongoose.Types.ObjectId().toString(), title: trimmed, completed: false } : null;
          }
          if (m && typeof m === "object" && m.title) {
            return {
              id: m.id || m._id?.toString() || new mongoose.Types.ObjectId().toString(),
              title: m.title.trim(),
              completed: Boolean(m.completed),
              completedAt: m.completedAt || null,
              completedBy: m.completedBy || null,
              completedByName: m.completedByName || "",
            };
          }
          return null;
        })
        .filter(Boolean);
      task.markModified("milestones");
    }

    if (assignedTo !== undefined) {
      if (assignedTo) {
        const u = await User.findOne({ _id: assignedTo, organizationId: orgId });
        if (!u) {
          return res.status(400).json({ message: "Assignee does not belong to your company." });
        }

        // Prevent unauthorized re-assignment
        const authorized = await isAuthorizedToAssign(user, u, task.parentTaskId, orgId);
        if (!authorized) {
          return res.status(403).json({
            message: "Unauthorized task assignment: You can only assign tasks to your team members or subordinates.",
          });
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

// DELETE /api/tasks/:id - Delete task and subtasks
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const task = await Task.findOne({ _id: req.params.id, organizationId: orgId });
    if (!task) {
      return res.status(404).json({ message: "Task not found in your company." });
    }

    const hasPerm = user.role === "admin" || user.permissions?.canDeleteTasks || (task.assignedBy && task.assignedBy.toString() === user.id.toString());
    if (!hasPerm) {
      return res.status(403).json({ message: "Access denied. You do not have permission to delete this task." });
    }

    await Task.deleteMany({ parentTaskId: task._id, organizationId: orgId });
    await Task.findByIdAndDelete(task._id);

    res.json({ message: "Task and all subtasks deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
