const express = require("express");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { getEffectiveSubordinateIds, requirePermission } = require("../middleware/rbac");

const router = express.Router();

// Helper to calculate progress for a project based on its tasks
async function calculateProjectMetrics(projectId, orgId) {
  const tasks = await Task.find({ projectId, organizationId: orgId });
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

    const taskProgress = t.status === "completed" ? 100 : t.progress || 0;
    weightedProgressSum += weight * taskProgress;

    if (t.status === "completed") {
      completedCount++;
    }

    if (t.deadline && t.deadline < today && t.status !== "completed") {
      overdueCount++;
    }
  }

  const progressPercentage = totalWeight > 0 ? Math.round(weightedProgressSum / totalWeight) : 0;

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

// GET /api/projects - Scope-based project listing with aggregated metrics (multi-company isolated)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;
    const orgId = currentUser.organizationId;
    let query = { organizationId: orgId };

    const projectScope = currentUser.accessScopes?.projectScope || (currentUser.role === "admin" ? "company" : "project");

    if (currentUser.role !== "admin" && projectScope !== "company") {
      if (projectScope === "department" && currentUser.department) {
        query.department = currentUser.department;
      } else if (projectScope === "team" && currentUser.team) {
        query.team = currentUser.team;
      } else {
        // Project or Own scope: projects user directs, created, or has tasks assigned to user/subordinates
        const subordinateIds = await getEffectiveSubordinateIds(currentUser.id, orgId);
        const relevantUserIds = [currentUser.id, ...subordinateIds];

        const userTasks = await Task.find({
          organizationId: orgId,
          $or: [
            { assignedTo: { $in: relevantUserIds } },
            { assignedBy: currentUser.id },
          ],
        }).select("projectId");

        const taskProjectIds = userTasks.map((t) => t.projectId).filter(Boolean);

        query.$or = [
          { directorId: currentUser.id },
          { createdBy: currentUser.id },
          { _id: { $in: taskProjectIds } },
        ];
      }
    }

    const projects = await Project.find(query)
      .populate("directorId", "firstName lastName email designation department")
      .sort({ createdAt: -1 });

    const enrichedProjects = await Promise.all(
      projects.map(async (p) => {
        const metrics = await calculateProjectMetrics(p._id, orgId);
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
    console.error("Fetch projects error:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/projects - Create a new high-level project container
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    // Check permission
    if (user.role !== "admin" && !user.permissions?.canCreateProjects) {
      return res.status(403).json({ message: "Access denied. You do not have permission to create projects." });
    }

    const { name, description, targetOutcome, directorId, deadline, priority, department, team } = req.body;

    if (!name || !deadline) {
      return res.status(400).json({ message: "Project name and deadline are required." });
    }

    const orgId = user.organizationId;
    let assignedDirectorId = directorId || user.id;
    let directorUser = null;

    if (assignedDirectorId) {
      directorUser = await User.findOne({ _id: assignedDirectorId, organizationId: orgId });
      if (!directorUser) {
        return res.status(400).json({ message: "Selected project director not found in this company." });
      }
    }

    const project = await Project.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      targetOutcome: targetOutcome ? targetOutcome.trim() : "",
      organizationId: orgId,
      department: department ? department.trim() : (directorUser?.department || user.department || "General"),
      team: team ? team.trim() : (user.team || ""),
      directorId: directorUser ? directorUser._id : user.id,
      directorName: directorUser ? `${directorUser.firstName} ${directorUser.lastName}` : "Unassigned",
      createdBy: user.id,
      deadline,
      priority: priority || "medium",
      status: "not-started",
    });

    const populatedProject = await Project.findById(project._id).populate(
      "directorId",
      "firstName lastName email designation department"
    );

    res.status(201).json({
      message: "Project container created successfully",
      project: populatedProject,
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(400).json({ message: error.message });
  }
});

// GET /api/projects/:id - Inspect detailed project overview and subordinate task tree
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const project = await Project.findOne({ _id: req.params.id, organizationId: orgId })
      .populate("directorId", "firstName lastName email designation department")
      .populate("createdBy", "firstName lastName email");

    if (!project) {
      return res.status(404).json({ message: "Project not found in your organization." });
    }

    const tasks = await Task.find({ projectId: project._id, organizationId: orgId })
      .populate("assignedTo", "firstName lastName email role designation")
      .populate("assignedBy", "firstName lastName role")
      .populate("parentTaskId", "title")
      .sort({ createdAt: 1 });

    const metrics = await calculateProjectMetrics(project._id, orgId);

    res.json({
      project,
      tasks,
      metrics,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/projects/:id - Update project parameters
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const project = await Project.findOne({ _id: req.params.id, organizationId: orgId });
    if (!project) {
      return res.status(404).json({ message: "Project not found in your organization." });
    }

    // Authorization check: Admin, Project Creator, Project Director, or has canEditProjects
    const isDirector = project.directorId && project.directorId.toString() === user.id.toString();
    const isCreator = project.createdBy && project.createdBy.toString() === user.id.toString();
    const hasPerm = user.role === "admin" || user.permissions?.canEditProjects || isDirector || isCreator;

    if (!hasPerm) {
      return res.status(403).json({ message: "Access denied. You do not have permission to edit this project." });
    }

    const { name, description, targetOutcome, directorId, deadline, priority, status, department, team } = req.body;

    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (targetOutcome !== undefined) project.targetOutcome = targetOutcome.trim();
    if (deadline) project.deadline = deadline;
    if (priority) project.priority = priority;
    if (status) project.status = status;
    if (department) project.department = department.trim();
    if (team !== undefined) project.team = team.trim();

    if (directorId) {
      const directorUser = await User.findOne({ _id: directorId, organizationId: orgId });
      if (directorUser) {
        project.directorId = directorUser._id;
        project.directorName = `${directorUser.firstName} ${directorUser.lastName}`;
      }
    }

    await project.save();

    const populated = await Project.findById(project._id).populate(
      "directorId",
      "firstName lastName email designation department"
    );

    res.json({ message: "Project updated successfully", project: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/projects/:id - Delete project and related tasks
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const project = await Project.findOne({ _id: req.params.id, organizationId: orgId });
    if (!project) {
      return res.status(404).json({ message: "Project not found in your organization." });
    }

    const hasPerm = user.role === "admin" || user.permissions?.canDeleteProjects;
    if (!hasPerm) {
      return res.status(403).json({ message: "Access denied. You do not have permission to delete projects." });
    }

    await Task.deleteMany({ projectId: project._id, organizationId: orgId });
    await Project.findByIdAndDelete(project._id);

    res.json({ message: "Project and all associated tasks deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
