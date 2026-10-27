const express = require("express");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Helper to calculate progress for a project based on its tasks
async function calculateProjectMetrics(projectId) {
  const tasks = await Task.find({ projectId });
  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      progressPercentage: 0,
      calculatedStatus: "not-started",
    };
  }

  let totalWeight = 0;
  let weightedProgressSum = 0;
  let completedCount = 0;
  let overdueCount = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const t of tasks) {
    const weight = t.weight || 1;
    totalWeight += weight;

    // A task is only 100% complete if status is 'completed'
    const taskProgress = t.status === "completed" ? 100 : t.progress || 0;
    weightedProgressSum += weight * taskProgress;

    if (t.status === "completed") {
      completedCount++;
    }

    if (t.deadline && t.deadline < today && t.status !== "completed") {
      overdueCount++;
    }
  }

  const progressPercentage = Math.round(weightedProgressSum / totalWeight);

  let calculatedStatus = "on-track";
  if (completedCount === totalTasks) {
    calculatedStatus = "completed";
  } else if (overdueCount > 0) {
    calculatedStatus = "delayed";
  } else if (progressPercentage === 0) {
    calculatedStatus = "not-started";
  }

  return {
    totalTasks,
    completedTasks: completedCount,
    overdueTasks: overdueCount,
    progressPercentage,
    calculatedStatus,
  };
}

// GET /api/projects - Role-based project listing with aggregated metrics
router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;
    let query = {};

    // Role-based visibility
    if (currentUser.role === "director") {
      query.directorId = currentUser.id;
    } else if (currentUser.role === "manager" || currentUser.role === "employee") {
      // Find projects where this user has assigned tasks
      const userTasks = await Task.find({ assignedTo: currentUser.id }).select("projectId");
      const projectIds = userTasks.map((t) => t.projectId).filter(Boolean);
      query._id = { $in: projectIds };
    }
    // Admin sees all projects

    const projects = await Project.find(query)
      .populate("directorId", "firstName lastName email designation department")
      .sort({ createdAt: -1 });

    const enrichedProjects = await Promise.all(
      projects.map(async (p) => {
        const metrics = await calculateProjectMetrics(p._id);
        const pObj = p.toObject();
        return {
          ...pObj,
          directorName: p.directorId
            ? `${p.directorId.firstName} ${p.directorId.lastName}`
            : p.directorName || "Unassigned",
          metrics,
        };
      })
    );

    res.json(enrichedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/projects - Admin creates a new project and assigns a Project Director
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, targetOutcome, directorId, deadline, priority } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Project name is required." });
    }
    if (!directorId) {
      return res.status(400).json({ message: "Please assign a Project Director." });
    }
    if (!deadline) {
      return res.status(400).json({ message: "Project deadline is required." });
    }

    const director = await User.findById(directorId);
    const directorName = director ? `${director.firstName} ${director.lastName}` : "Assigned Director";

    const project = await Project.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      targetOutcome: targetOutcome ? targetOutcome.trim() : "",
      directorId,
      directorName,
      createdBy: req.user.id,
      deadline,
      priority: priority || "medium",
      status: "not-started",
    });

    res.status(201).json({
      message: "Project successfully initialized with Project Director",
      project,
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(400).json({ message: error.message });
  }
});

// GET /api/projects/:id - Project details with task hierarchy
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("directorId", "firstName lastName email designation")
      .populate("createdBy", "firstName lastName email");

    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const tasks = await Task.find({ projectId: project._id })
      .populate("assignedTo", "firstName lastName email designation role")
      .populate("assignedBy", "firstName lastName email role")
      .sort({ createdAt: 1 });

    const metrics = await calculateProjectMetrics(project._id);

    res.json({
      project: {
        ...project.toObject(),
        directorName: project.directorId
          ? `${project.directorId.firstName} ${project.directorId.lastName}`
          : project.directorName,
        metrics,
      },
      tasks,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/projects/:id - Update project
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const { name, description, targetOutcome, directorId, deadline, priority, status } = req.body;
    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (targetOutcome !== undefined) project.targetOutcome = targetOutcome.trim();
    if (deadline) project.deadline = deadline;
    if (priority) project.priority = priority;
    if (status) project.status = status;

    if (directorId && directorId !== project.directorId?.toString()) {
      const director = await User.findById(directorId);
      if (director) {
        project.directorId = directorId;
        project.directorName = `${director.firstName} ${director.lastName}`;
      }
    }

    await project.save();
    res.json({ message: "Project updated successfully", project });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/projects/:id - Delete project and its tasks
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await Task.deleteMany({ projectId: req.params.id });
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: "Project and associated tasks deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
