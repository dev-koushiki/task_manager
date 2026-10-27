const express = require("express");
const Task = require("../models/Task");
const TaskUpdate = require("../models/TaskUpdate");
const TaskReview = require("../models/TaskReview");
const User = require("../models/User");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Helper to get all subordinate IDs for a user recursively
async function getSubordinateIds(userId) {
  const directSubordinates = await User.find({ reportsTo: userId }).select("_id");
  let allIds = directSubordinates.map((u) => u._id);

  for (const sub of directSubordinates) {
    const subIds = await getSubordinateIds(sub._id);
    allIds = allIds.concat(subIds);
  }
  return allIds;
}

// GET /api/tasks - Hierarchical role-filtered task list
router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;
    let query = {};

    if (currentUser.role === "employee") {
      // Junior Employee sees only tasks assigned to them
      query.assignedTo = currentUser.id;
    } else if (currentUser.role === "manager") {
      // Manager sees tasks assigned to them + tasks assigned to their subordinates
      const subordinateIds = await getSubordinateIds(currentUser.id);
      query.$or = [
        { assignedTo: currentUser.id },
        { assignedBy: currentUser.id },
        { assignedTo: { $in: subordinateIds } },
      ];
    } else if (currentUser.role === "director") {
      // Director sees all tasks under their projects or assigned by/to them
      const directorProjects = await Project.find({ directorId: currentUser.id }).select("_id");
      const projectIds = directorProjects.map((p) => p._id);
      query.$or = [
        { projectId: { $in: projectIds } },
        { assignedBy: currentUser.id },
        { assignedTo: currentUser.id },
      ];
    }
    // Admin sees all tasks

    const tasks = await Task.find(query)
      .populate("assignedTo", "firstName lastName email designation role")
      .populate("assignedBy", "firstName lastName email role")
      .populate("projectId", "name deadline status")
      .populate("parentTaskId", "title")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("Fetch tasks error:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/tasks - Create task or subtask with hierarchical reporting
router.post("/", authMiddleware, async (req, res) => {
  try {
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
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Task title is required." });
    }

    let assignedToUser = null;
    let assignedToName = "Unassigned";

    if (assignedTo) {
      assignedToUser = await User.findById(assignedTo);
      if (assignedToUser) {
        assignedToName = `${assignedToUser.firstName} ${assignedToUser.lastName}`;
      }
    }

    const assignedByName = `${req.user.firstName || "Supervisor"} ${req.user.lastName || ""}`.trim();

    const task = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      projectId: projectId || null,
      parentTaskId: parentTaskId || null,
      assignedTo: assignedToUser ? assignedToUser._id : null,
      assignedToName,
      assignedBy: req.user.id,
      assignedByName,
      deadline: deadline || dueDate || "",
      dueDate: dueDate || deadline || "",
      priority: priority || "medium",
      weight: weight ? Number(weight) : 1,
      status: status || "not-started",
      progress: status === "completed" ? 100 : 0,
      user: req.user.id,
    });

    res.status(201).json({
      message: "Task successfully created and assigned",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(400).json({ message: error.message });
  }
});

// PATCH /api/tasks/:id/progress - Employee updates progress %, status, and blockers
router.patch("/:id/progress", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
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

    // Auto-update status if progress is 100% and not yet submitted/completed
    if (task.progress === 100 && task.status === "in-progress") {
      task.status = "submitted";
    }

    await task.save();

    // Log update in TaskUpdate audit history
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

// POST /api/tasks/:id/submit - Employee submits work for supervisor review
router.post("/:id/submit", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
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

// POST /api/tasks/:id/review - Supervisor approves or requests changes
router.post("/:id/review", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    const { decision, feedback } = req.body; // decision: "approved" | "changes_requested"

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
      task.progress = Math.min(task.progress, 80); // Set back to revision progress
      task.reviewFeedback = feedback ? feedback.trim() : "Changes requested by supervisor.";
      task.reviewedBy = req.user.id;
      task.reviewedAt = new Date();
    }

    await task.save();

    // Record review in TaskReview collection
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

// PUT /api/tasks/:id - Update task details
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    const { title, description, status, priority, dueDate, deadline, assignedTo, weight } = req.body;

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (deadline !== undefined) task.deadline = deadline;
    if (weight !== undefined) task.weight = Number(weight);

    if (assignedTo !== undefined) {
      if (assignedTo) {
        const u = await User.findById(assignedTo);
        task.assignedTo = u ? u._id : null;
        task.assignedToName = u ? `${u.firstName} ${u.lastName}` : "Unassigned";
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

// DELETE /api/tasks/:id - Delete task and its subtasks
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await Task.deleteMany({ parentTaskId: req.params.id });
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: "Task and subtasks deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
