const express = require("express");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");
const { getEffectiveSubordinateIds } = require("../middleware/rbac");
const aiService = require("../services/aiService");

const router = express.Router();

/**
 * Helper to calculate metrics for a project
 * Factors in both project.milestones (underneath the project) and legacy Task records
 */
/**
 * Helper to calculate metrics for a project
 * Factors in project.milestones (direct project deliverables) with weighted completion:
 * Project Progress (%) = (Total Effort Weight of Completed Milestones / Total Effort Weight of All Milestones) * 100
 * Falls back to legacy tasks if no project milestones exist (preserving compatibility).
 */
async function calculateProjectMetrics(project, orgId) {
  const pMilestones = Array.isArray(project.milestones) ? project.milestones : [];
  const tasks = await Task.find({ projectId: project._id, organizationId: orgId });

  const totalMilestones = pMilestones.length;
  let completedMilestones = 0;
  let inProgressMilestones = 0;
  let pendingMilestones = 0;
  let overdueMilestones = 0;
  let totalEffortWeight = 0;
  let completedEffortWeight = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const m of pMilestones) {
    const weight = Number(m.weight) || 1;
    totalEffortWeight += weight;

    const isCompleted = Boolean(m.completed) || m.status === "completed";
    if (isCompleted) {
      completedMilestones++;
      completedEffortWeight += weight;
    } else if (m.status === "in-progress" || m.status === "submitted") {
      inProgressMilestones++;
    } else {
      pendingMilestones++;
    }

    if (m.deadline && m.deadline < today && !isCompleted) {
      overdueMilestones++;
    }
  }

  // Also count tasks if any (for historical compatibility)
  let totalTasks = tasks.length;
  let completedTasks = 0;
  let taskTotalWeight = 0;
  let taskCompletedWeight = 0;
  for (const t of tasks) {
    const tw = Number(t.weight) || 1;
    taskTotalWeight += tw;
    if (t.status === "completed") {
      completedTasks++;
      taskCompletedWeight += tw;
    }
  }

  let progressPercentage = 0;
  if (totalMilestones > 0) {
    // Direct milestone weighted calculation from Section 7
    progressPercentage = totalEffortWeight > 0
      ? Math.round((completedEffortWeight / totalEffortWeight) * 100)
      : Math.round((completedMilestones / totalMilestones) * 100);
  } else if (totalTasks > 0) {
    progressPercentage = taskTotalWeight > 0
      ? Math.round((taskCompletedWeight / taskTotalWeight) * 100)
      : Math.round((completedTasks / totalTasks) * 100);
  }

  const milestoneCompletionRate = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  let calculatedStatus = project.status || "not-started";
  if (totalMilestones > 0) {
    if (completedMilestones === totalMilestones && totalMilestones > 0) {
      calculatedStatus = "completed";
    } else if (overdueMilestones > 0) {
      calculatedStatus = "delayed";
    } else if (inProgressMilestones > 0 || completedMilestones > 0 || progressPercentage > 0) {
      calculatedStatus = "in-progress";
    } else {
      calculatedStatus = "not-started";
    }
  } else if (totalTasks > 0) {
    if (completedTasks === totalTasks && totalTasks > 0) {
      calculatedStatus = "completed";
    } else if (completedTasks > 0 || progressPercentage > 0) {
      calculatedStatus = "in-progress";
    } else {
      calculatedStatus = "not-started";
    }
  }

  return {
    totalMilestones,
    completedMilestones,
    inProgressMilestones,
    pendingMilestones,
    overdueMilestones,
    totalEffortWeight,
    completedEffortWeight,
    milestoneCompletionRate,
    totalTasks,
    completedTasks,
    combinedTotal: totalMilestones || totalTasks,
    combinedCompleted: completedMilestones || completedTasks,
    progressPercentage,
    calculatedStatus,
  };
}

// Helper: Send project or milestone notification with duplicate prevention
async function sendProjectNotification({
  userId,
  organizationId,
  type,
  title,
  message,
  link,
  projectId,
  milestoneId,
}) {
  if (!userId) return null;
  try {
    // Check if duplicate notification already sent in past 24 hours
    const duplicateQuery = {
      userId,
      type,
      link,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    };
    const existing = await Notification.findOne(duplicateQuery);
    if (existing) {
      return existing; // Prevent duplicate notification
    }

    return await Notification.create({
      userId,
      organizationId: organizationId || null,
      type,
      title,
      message,
      link,
      read: false,
      metadata: {
        projectId: projectId ? String(projectId) : undefined,
        milestoneId: milestoneId ? String(milestoneId) : undefined,
      },
    });
  } catch (err) {
    console.warn("sendProjectNotification error:", err.message);
    return null;
  }
}

// Helper: Send task assignment notification with duplicate prevention
async function sendTaskNotification({
  userId,
  organizationId,
  type,
  title,
  message,
  link,
  taskId,
  metadata = {},
}) {
  if (!userId) return null;
  try {
    const duplicateQuery = {
      userId,
      type,
      link,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    };
    const existing = await Notification.findOne(duplicateQuery);
    if (existing) return existing;

    return await Notification.create({
      userId,
      organizationId: organizationId || null,
      type,
      title,
      message,
      link,
      read: false,
      metadata: {
        taskId: taskId ? String(taskId) : undefined,
        ...metadata,
      },
    });
  } catch (err) {
    console.warn("sendTaskNotification error:", err.message);
    return null;
  }
}

// -------------------------------------------------------------
// POST /api/projects/analyze-concept-note - Upload & analyze concept note with AI
// -------------------------------------------------------------
router.post("/analyze-concept-note", authMiddleware, async (req, res) => {
  try {
    const { fileData, filename, mimeType, rawText } = req.body;

    let textToAnalyze = rawText || "";

    if (!textToAnalyze && fileData) {
      // Decode base64 buffer
      const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      textToAnalyze = await aiService.extractDocumentText(buffer, mimeType, filename);
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      return res.status(400).json({
        message: "Unable to extract text from the uploaded document. Please check the file format or provide text directly.",
      });
    }

    const analysis = await aiService.analyzeConceptNote(textToAnalyze, filename);

    res.json({
      success: true,
      analysis,
      rawTextSnippet: textToAnalyze.slice(0, 1000),
    });
  } catch (error) {
    console.error("Concept note analysis error:", error);
    res.status(500).json({ message: error.message || "Failed to analyze concept note." });
  }
});

// -------------------------------------------------------------
// POST /api/projects/transcribe - Transcribe voice note audio with AI
// -------------------------------------------------------------
router.post("/transcribe", authMiddleware, async (req, res) => {
  try {
    const { audioBase64, mimeType, language } = req.body;
    const result = await aiService.transcribeAudio({ audioBase64, mimeType, language });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Audio transcription error:", error);
    res.status(500).json({ message: error.message || "Failed to transcribe audio." });
  }
});

// -------------------------------------------------------------
// POST /api/projects/extract-from-transcript - Extract milestones from voice transcript
// -------------------------------------------------------------
router.post("/extract-from-transcript", authMiddleware, async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ message: "Transcript text is required." });
    }
    const extracted = await aiService.extractFromTranscript(transcript);
    res.json({ success: true, extracted });
  } catch (error) {
    console.error("Transcript extraction error:", error);
    res.status(500).json({ message: error.message || "Failed to extract project details from transcript." });
  }
});

// -------------------------------------------------------------
// GET /api/projects - Scope-based project listing with milestones & metrics
// -------------------------------------------------------------
router.get("/", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;
    const orgId = currentUser.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: currentUser.companyName }] }
      : { companyName: currentUser.companyName };
    let query = { ...orgCondition };

    const projectScope =
      currentUser.accessScopes?.projectScope || (currentUser.role === "admin" ? "company" : "project");

    if (currentUser.role !== "admin" && projectScope !== "company") {
      if (projectScope === "department" && currentUser.department) {
        query.department = currentUser.department;
      } else if (projectScope === "team" && currentUser.team) {
        query.team = currentUser.team;
      } else {
        const subordinateIds = await getEffectiveSubordinateIds(currentUser.id, orgId);
        const relevantUserIds = [currentUser.id, ...subordinateIds];

        const userTasks = await Task.find({
          ...orgCondition,
          $or: [{ assignedTo: { $in: relevantUserIds } }, { assignedBy: currentUser.id }],
        }).select("projectId");

        const taskProjectIds = userTasks.map((t) => t.projectId).filter(Boolean);

        query = {
          ...orgCondition,
          $or: [
            { directorId: currentUser.id },
            { createdBy: currentUser.id },
            { "assignedEmployees.userId": { $in: relevantUserIds } },
            { "milestones.assignedTo.userId": { $in: relevantUserIds } },
            { _id: { $in: taskProjectIds } },
          ],
        };
      }
    }

    const projects = await Project.find(query)
      .populate("directorId", "firstName lastName email designation department")
      .sort({ createdAt: -1 });

    const enrichedProjects = await Promise.all(
      projects.map(async (p) => {
        const metrics = await calculateProjectMetrics(p, orgId);
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

// -------------------------------------------------------------
// POST /api/projects - Create project with milestones, domain/dept, dates & employee assignment
// -------------------------------------------------------------
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    if (user.role !== "admin" && !user.permissions?.canCreateProjects) {
      return res.status(403).json({ message: "Access denied. You do not have permission to create projects." });
    }

    const {
      name,
      description,
      targetOutcome,
      objectives,
      expectedDeliverables,
      directorId,
      startDate,
      targetCompletionDate,
      deadline,
      priority,
      department,
      team,
      assignedEmployeeIds,
      milestones,
      phases,
      conceptNote,
    } = req.body;

    if (!name || (!deadline && !targetCompletionDate)) {
      return res.status(400).json({
        message: "Project name and target completion date / deadline are required.",
      });
    }

    // Determine Project Director
    let assignedDirectorId = directorId || user.id;
    let directorUser = null;

    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    if (assignedDirectorId) {
      directorUser = await User.findOne({ _id: assignedDirectorId, ...orgCondition });
    }

    // Resolve assigned employees
    let assignedEmployeesList = [];
    if (Array.isArray(assignedEmployeeIds) && assignedEmployeeIds.length > 0) {
      const emps = await User.find({
        _id: { $in: assignedEmployeeIds },
        ...orgCondition,
      }).select("firstName lastName email role designation team");

      assignedEmployeesList = emps.map((emp) => ({
        userId: emp._id,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.email,
        role: emp.role || "employee",
        designation: emp.designation || "",
        team: emp.team || "",
        assignedAt: new Date(),
      }));
    }

    // Process initial milestones if provided (e.g. from Concept Note AI)
    let processedMilestones = [];
    if (Array.isArray(milestones)) {
      processedMilestones = milestones.map((m, idx) => ({
        title: m.title ? m.title.trim() : `Milestone ${idx + 1}`,
        description: m.description ? m.description.trim() : "",
        deadline: m.deadline || m.suggestedDeadline || targetCompletionDate || deadline || "",
        dueDate: m.dueDate || m.deadline || m.suggestedDeadline || "",
        status: m.status || "not-started",
        progress: m.progress || 0,
        completed: Boolean(m.completed),
        phase: m.phase || "",
        order: idx,
      }));
    }

    const project = await Project.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      targetOutcome: targetOutcome ? targetOutcome.trim() : "",
      objectives: Array.isArray(objectives) ? objectives : objectives ? [objectives] : [],
      expectedDeliverables: Array.isArray(expectedDeliverables)
        ? expectedDeliverables
        : expectedDeliverables
        ? [expectedDeliverables]
        : [],
      organizationId: orgId,
      companyName: user.companyName || "",
      department: department ? department.trim() : directorUser?.department || user.department || "General",
      team: team ? team.trim() : user.team || "",
      directorId: directorUser ? directorUser._id : user.id,
      directorName: directorUser ? `${directorUser.firstName} ${directorUser.lastName}`.trim() : "Unassigned",
      createdBy: user.id,
      startDate: startDate || "",
      targetCompletionDate: targetCompletionDate || deadline || "",
      deadline: targetCompletionDate || deadline || "",
      priority: priority || "medium",
      status: "not-started",
      assignedEmployees: assignedEmployeesList,
      milestones: processedMilestones,
      phases: Array.isArray(phases) ? phases : [],
      conceptNote: conceptNote || null,
    });

    // Notify assigned employees (with 24-hr deduplication)
    if (assignedEmployeesList.length > 0) {
      for (const emp of assignedEmployeesList) {
        if (emp.userId.toString() !== user.id.toString()) {
          await sendProjectNotification({
            userId: emp.userId,
            organizationId: orgId,
            type: "project_assigned",
            title: `Assigned to Project: ${project.name}`,
            message: `${user.firstName || "Admin"} assigned you to project "${project.name}". Target completion: ${
              project.targetCompletionDate || project.deadline || "TBD"
            }.`,
            link: `/dashboard?tab=tasks&projectId=${project._id}`,
            projectId: project._id,
          });
        }
      }
    }

    const populatedProject = await Project.findById(project._id).populate(
      "directorId",
      "firstName lastName email designation department"
    );

    const metrics = await calculateProjectMetrics(populatedProject, orgId);

    res.status(201).json({
      message: "Project created successfully with milestones",
      project: {
        ...populatedProject.toObject(),
        metrics,
      },
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(400).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// POST /api/projects/create-with-milestones - Create Project with Direct Milestones / Deliverables
// -------------------------------------------------------------
async function handleCreateProjectWithMilestones(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const {
      name,
      department,
      priority,
      targetOutcome,
      startDate,
      targetCompletionDate,
      deadline,
      directorId,
      description,
      assignedEmployeeIds = [],
      milestones = [],
    } = req.body;

    // 1. Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Project name is required." });
    }

    const finalCompletionDate = targetCompletionDate || deadline;
    if (!finalCompletionDate) {
      return res.status(400).json({ message: "Target completion date is required." });
    }

    if (startDate && finalCompletionDate && startDate > finalCompletionDate) {
      return res.status(400).json({
        message: "Target completion date cannot be earlier than project start date.",
      });
    }

    if (!targetOutcome || !targetOutcome.trim()) {
      return res.status(400).json({ message: "Target outcome / objective is required." });
    }

    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ message: "At least one milestone deliverable must be created with the project." });
    }

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title || !m.title.trim()) {
        return res.status(400).json({ message: `Milestone #${i + 1} requires a title.` });
      }
      if (!m.deadline && !m.dueDate && !finalCompletionDate) {
        return res.status(400).json({ message: `Milestone #${i + 1} ("${m.title}") requires a completion deadline.` });
      }
    }

    // 2. Resolve Director
    let assignedDirectorId = directorId || user.id;
    let directorUser = null;
    if (assignedDirectorId) {
      directorUser = await User.findOne({ _id: assignedDirectorId, ...orgCondition });
    }

    // 3. Collect all unique user IDs involved (selected team + milestone assignees + director)
    const allUserIds = new Set();
    if (Array.isArray(assignedEmployeeIds)) {
      assignedEmployeeIds.forEach((id) => id && allUserIds.add(String(id)));
    }
    milestones.forEach((m) => {
      if (m.assignedTo) allUserIds.add(String(m.assignedTo));
      if (m.assignedToUser) allUserIds.add(String(m.assignedToUser));
    });
    if (directorUser) {
      allUserIds.add(String(directorUser._id));
    }

    const users = await User.find({
      _id: { $in: Array.from(allUserIds) },
      ...orgCondition,
    }).select("firstName lastName email role designation team department");

    const userMap = new Map();
    users.forEach((u) => userMap.set(String(u._id), u));

    // Build assignedEmployees array for the Project
    const assignedEmployeesList = users.map((emp) => ({
      userId: emp._id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      email: emp.email,
      role: emp.role || "employee",
      designation: emp.designation || "",
      team: emp.team || "",
      assignedAt: new Date(),
    }));

    // 4. Construct direct Project Milestones
    const processedMilestones = [];
    const assignedByName = `${user.firstName || "Admin"} ${user.lastName || ""}`.trim();

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const milestoneId = m.id || new mongoose.Types.ObjectId().toString();
      const assigneeId = m.assignedTo || m.assignedToUser || null;
      let assignedUser = assigneeId ? userMap.get(String(assigneeId)) : null;

      const assignedEmpSubdocs = assignedUser ? [{
        userId: assignedUser._id,
        name: `${assignedUser.firstName} ${assignedUser.lastName}`.trim(),
        email: assignedUser.email,
        role: assignedUser.role || "employee",
        designation: assignedUser.designation || "",
        team: assignedUser.team || "",
        assignedAt: new Date(),
      }] : [];

      const mDeadline = m.deadline || m.dueDate || finalCompletionDate;
      const mWeight = Math.max(1, Math.min(5, Number(m.weight) || 1));
      const mStatus = m.status || "not-started";
      const mPriority = (m.priority || "medium").toLowerCase();
      const isCompleted = mStatus === "completed" || Boolean(m.completed);

      processedMilestones.push({
        id: milestoneId,
        title: m.title.trim(),
        description: (m.description || "").trim(),
        assignedTo: assignedEmpSubdocs,
        assignedToUser: assignedUser ? assignedUser._id : null,
        assignedToName: assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}`.trim() : "Unassigned",
        deadline: mDeadline,
        dueDate: mDeadline,
        weight: mWeight,
        priority: mPriority,
        status: mStatus,
        progress: isCompleted ? 100 : 0,
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedBy: isCompleted ? user.id : null,
        completedByName: isCompleted ? assignedByName : "",
        order: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 5. Create Project document
    let project = null;
    try {
      project = await Project.create({
        name: name.trim(),
        description: description ? description.trim() : "",
        targetOutcome: targetOutcome ? targetOutcome.trim() : "",
        organizationId: orgId,
        companyName: user.companyName || "",
        department: department ? department.trim() : (directorUser?.department || user.department || "General"),
        team: user.team || "",
        directorId: directorUser ? directorUser._id : user.id,
        directorName: directorUser ? `${directorUser.firstName} ${directorUser.lastName}`.trim() : "Unassigned",
        createdBy: user.id,
        startDate: startDate || "",
        targetCompletionDate: finalCompletionDate,
        deadline: finalCompletionDate,
        priority: (priority || "medium").toLowerCase(),
        status: "not-started",
        progress: 0,
        assignedEmployees: assignedEmployeesList,
        milestones: processedMilestones,
      });
    } catch (projErr) {
      console.error("Error creating project:", projErr);
      return res.status(400).json({ message: "Failed to create project: " + projErr.message });
    }

    // 6. Create synchronized adapter deliverable in Task collection
    // (Preserves employee workload, performance calculation engine, and existing task view compatibility)
    const createdTasks = [];
    try {
      for (const m of processedMilestones) {
        const assignedUser = m.assignedToUser ? userMap.get(String(m.assignedToUser)) : null;
        const createdTask = await Task.create({
          title: m.title,
          description: m.description,
          organizationId: orgId,
          department: project.department,
          team: assignedUser?.team || project.team || "",
          projectId: project._id,
          assignedTo: assignedUser ? assignedUser._id : null,
          assignedToName: m.assignedToName,
          assignedBy: user.id,
          assignedByName,
          deadline: m.deadline,
          dueDate: m.deadline,
          priority: m.priority,
          weight: m.weight,
          status: m.status,
          progress: m.progress,
          user: user.id,
          milestones: [
            {
              id: m.id,
              title: m.title,
              completed: m.completed,
              completedAt: m.completedAt,
              completedBy: m.completedBy,
              completedByName: m.completedByName,
            },
          ],
        });

        // Notify milestone assignee
        if (assignedUser && assignedUser._id.toString() !== user.id.toString()) {
          await sendProjectNotification({
            userId: assignedUser._id,
            organizationId: orgId,
            type: "milestone_assigned",
            title: `Milestone Deliverable Assigned: ${m.title}`,
            message: `${user.firstName || "Admin"} assigned you milestone deliverable "${m.title}" in project "${project.name}". Completion deadline: ${m.deadline}.`,
            link: `/dashboard?tab=tasks&projectId=${project._id}`,
            projectId: project._id,
            milestoneId: m.id,
          });
        }

        createdTasks.push(createdTask);
      }
    } catch (taskErr) {
      console.warn("Could not create adapter deliverable task:", taskErr.message);
    }

    // 7. Notify all project team members
    if (assignedEmployeesList.length > 0) {
      for (const emp of assignedEmployeesList) {
        if (emp.userId.toString() !== user.id.toString()) {
          await sendProjectNotification({
            userId: emp.userId,
            organizationId: orgId,
            type: "project_assigned",
            title: `Assigned to Project: ${project.name}`,
            message: `${user.firstName || "Admin"} assigned you to project "${project.name}". Target completion: ${finalCompletionDate}.`,
            link: `/dashboard?tab=tasks&projectId=${project._id}`,
            projectId: project._id,
          });
        }
      }
    }

    // 8. Calculate weighted project metrics
    const populatedProject = await Project.findById(project._id).populate(
      "directorId",
      "firstName lastName email designation department"
    );
    const metrics = await calculateProjectMetrics(populatedProject, orgId);

    res.status(201).json({
      success: true,
      message: "Project and milestones created and assigned successfully",
      project: {
        ...populatedProject.toObject(),
        metrics,
      },
      milestones: populatedProject.milestones,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Create project with milestones error:", error);
    res.status(500).json({ message: error.message || "Failed to create project with milestones" });
  }
}

router.post("/create-with-milestones", authMiddleware, handleCreateProjectWithMilestones);

// -------------------------------------------------------------
// POST /api/projects/create-with-tasks - Unified creation of Project + Team + Deliverables
// -------------------------------------------------------------
router.post("/create-with-tasks", authMiddleware, async (req, res) => {
  // If milestones array is passed directly (new format), delegate to handleCreateProjectWithMilestones
  if (Array.isArray(req.body.milestones) && req.body.milestones.length > 0 && (!req.body.tasks || req.body.tasks.length === 0)) {
    return handleCreateProjectWithMilestones(req, res);
  }

  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const {
      name,
      department,
      priority,
      targetOutcome,
      startDate,
      targetCompletionDate,
      deadline,
      directorId,
      description,
      assignedEmployeeIds = [],
      tasks = [],
    } = req.body;

    // 1. Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Project name is required." });
    }

    const finalCompletionDate = targetCompletionDate || deadline;
    if (!finalCompletionDate) {
      return res.status(400).json({ message: "Target completion date is required." });
    }

    if (startDate && finalCompletionDate && startDate > finalCompletionDate) {
      return res.status(400).json({
        message: "Target completion date cannot be earlier than project start date.",
      });
    }

    if (!targetOutcome || !targetOutcome.trim()) {
      return res.status(400).json({ message: "Target outcome / objective is required." });
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: "At least one task must be created with the project." });
    }

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t.title || !t.title.trim()) {
        return res.status(400).json({ message: `Task #${i + 1} requires a title.` });
      }
      if (!t.deadline && !t.dueDate) {
        return res.status(400).json({ message: `Task #${i + 1} ("${t.title}") requires a completion deadline.` });
      }
    }

    // 2. Resolve Director
    let assignedDirectorId = directorId || user.id;
    let directorUser = null;
    if (assignedDirectorId) {
      directorUser = await User.findOne({ _id: assignedDirectorId, ...orgCondition });
    }

    // 3. Collect all unique user IDs involved (selected team + task assignees + director)
    const allUserIds = new Set();
    if (Array.isArray(assignedEmployeeIds)) {
      assignedEmployeeIds.forEach((id) => id && allUserIds.add(String(id)));
    }
    tasks.forEach((t) => {
      if (t.assignedTo) allUserIds.add(String(t.assignedTo));
    });
    if (directorUser) {
      allUserIds.add(String(directorUser._id));
    }

    const users = await User.find({
      _id: { $in: Array.from(allUserIds) },
      ...orgCondition,
    }).select("firstName lastName email role designation team department");

    const userMap = new Map();
    users.forEach((u) => userMap.set(String(u._id), u));

    // Build assignedEmployees array for the Project
    const assignedEmployeesList = users.map((emp) => ({
      userId: emp._id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      email: emp.email,
      role: emp.role || "employee",
      designation: emp.designation || "",
      team: emp.team || "",
      assignedAt: new Date(),
    }));

    // 4. Create Project document
    let project = null;
    try {
      project = await Project.create({
        name: name.trim(),
        description: description ? description.trim() : "",
        targetOutcome: targetOutcome ? targetOutcome.trim() : "",
        organizationId: orgId,
        companyName: user.companyName || "",
        department: department ? department.trim() : (directorUser?.department || user.department || "General"),
        team: user.team || "",
        directorId: directorUser ? directorUser._id : user.id,
        directorName: directorUser ? `${directorUser.firstName} ${directorUser.lastName}`.trim() : "Unassigned",
        createdBy: user.id,
        startDate: startDate || "",
        targetCompletionDate: finalCompletionDate,
        deadline: finalCompletionDate,
        priority: (priority || "medium").toLowerCase(),
        status: "not-started",
        progress: 0,
        assignedEmployees: assignedEmployeesList,
        milestones: [],
      });
    } catch (projErr) {
      console.error("Error creating project:", projErr);
      return res.status(400).json({ message: "Failed to create project: " + projErr.message });
    }

    // 5. Create each Task (with atomic rollback on failure)
    const createdTasks = [];
    try {
      const assignedByName = `${user.firstName || "Admin"} ${user.lastName || ""}`.trim();

      for (const t of tasks) {
        let assignedToUser = null;
        let assignedToName = "Unassigned";
        if (t.assignedTo) {
          assignedToUser = userMap.get(String(t.assignedTo)) || null;
          if (assignedToUser) {
            assignedToName = `${assignedToUser.firstName} ${assignedToUser.lastName}`.trim();
          }
        }

        // Sanitize milestones
        let sanitizedMilestones = [];
        if (Array.isArray(t.milestones)) {
          sanitizedMilestones = t.milestones
            .map((m) => {
              if (typeof m === "string") {
                const trimmed = m.trim();
                return trimmed
                  ? {
                      id: new mongoose.Types.ObjectId().toString(),
                      title: trimmed,
                      completed: false,
                    }
                  : null;
              }
              if (m && typeof m === "object" && m.title && m.title.trim()) {
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

        const taskDeadline = t.deadline || t.dueDate || finalCompletionDate;
        const taskInitialStatus = t.status || "not-started";

        const createdTask = await Task.create({
          title: t.title.trim(),
          description: t.description ? t.description.trim() : "",
          organizationId: orgId,
          department: t.department || project.department,
          team: t.team || (assignedToUser?.team || project.team || ""),
          projectId: project._id,
          assignedTo: assignedToUser ? assignedToUser._id : null,
          assignedToName,
          assignedBy: user.id,
          assignedByName,
          deadline: taskDeadline,
          dueDate: taskDeadline,
          priority: (t.priority || "medium").toLowerCase(),
          weight: t.weight ? Number(t.weight) : 1,
          status: taskInitialStatus,
          progress: taskInitialStatus === "completed" ? 100 : 0,
          user: user.id,
          milestones: sanitizedMilestones,
        });

        // Notification to task assignee
        if (assignedToUser && assignedToUser._id.toString() !== user.id.toString()) {
          await sendTaskNotification({
            userId: assignedToUser._id,
            organizationId: orgId,
            type: "task_assigned",
            title: "New Task Assigned",
            message: `${assignedByName} assigned you: "${createdTask.title}" in project "${project.name}".`,
            link: `/tasks/${createdTask._id}`,
            taskId: createdTask._id,
            metadata: { taskId: createdTask._id, assignedBy: user.id, projectId: project._id },
          });
        }

        createdTasks.push(createdTask);
      }
    } catch (taskErr) {
      console.error("Error creating tasks, rolling back project and partial tasks:", taskErr);
      if (createdTasks.length > 0) {
        await Task.deleteMany({ _id: { $in: createdTasks.map((t) => t._id) } });
      }
      await Project.deleteOne({ _id: project._id });
      return res.status(500).json({
        message: "Failed to create all tasks. All changes were rolled back: " + taskErr.message,
      });
    }

    // 6. Project member notifications
    if (assignedEmployeesList.length > 0) {
      for (const emp of assignedEmployeesList) {
        if (emp.userId.toString() !== user.id.toString()) {
          await sendProjectNotification({
            userId: emp.userId,
            organizationId: orgId,
            type: "project_assigned",
            title: `Assigned to Project: ${project.name}`,
            message: `${user.firstName || "Admin"} assigned you to project "${project.name}". Target completion: ${finalCompletionDate}.`,
            link: `/dashboard?tab=tasks&projectId=${project._id}`,
            projectId: project._id,
          });
        }
      }
    }

    // 7. Calculate metrics and return
    const populatedProject = await Project.findById(project._id).populate(
      "directorId",
      "firstName lastName email designation department"
    );
    const metrics = await calculateProjectMetrics(populatedProject, orgId);

    const populatedTasks = await Task.find({ _id: { $in: createdTasks.map((t) => t._id) } })
      .populate("assignedTo", "firstName lastName email designation positionTitle role")
      .populate("assignedBy", "firstName lastName email role")
      .populate("projectId", "name deadline status priority");

    res.status(201).json({
      success: true,
      message: "Project and tasks created and assigned successfully",
      project: {
        ...populatedProject.toObject(),
        metrics,
      },
      tasks: populatedTasks,
    });
  } catch (error) {
    console.error("Create project with tasks error:", error);
    res.status(500).json({ message: error.message || "Failed to create project with tasks" });
  }
});

// -------------------------------------------------------------
// GET /api/projects/:id - Inspect detailed project overview and milestones
// -------------------------------------------------------------
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition })
      .populate("directorId", "firstName lastName email designation department")
      .populate("createdBy", "firstName lastName email")
      .populate("assignedEmployees.userId", "firstName lastName email designation role team");

    if (!project) {
      return res.status(404).json({ message: "Project not found in your organization." });
    }

    const tasks = await Task.find({ projectId: project._id, ...orgCondition })
      .populate("assignedTo", "firstName lastName email role designation")
      .populate("assignedBy", "firstName lastName role")
      .sort({ createdAt: 1 });

    const metrics = await calculateProjectMetrics(project, orgId);

    res.json({
      project,
      tasks,
      metrics,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// PUT /api/projects/:id - Update project parameters (dates, department, details)
// -------------------------------------------------------------
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found in your organization." });
    }

    const isDirector = project.directorId && project.directorId.toString() === user.id.toString();
    const isCreator = project.createdBy && project.createdBy.toString() === user.id.toString();
    const hasPerm = user.role === "admin" || user.permissions?.canEditProjects || isDirector || isCreator;

    if (!hasPerm) {
      return res.status(403).json({ message: "Access denied. You do not have permission to edit this project." });
    }

    const {
      name,
      description,
      targetOutcome,
      objectives,
      expectedDeliverables,
      directorId,
      startDate,
      targetCompletionDate,
      deadline,
      priority,
      status,
      department,
      team,
    } = req.body;

    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (targetOutcome !== undefined) project.targetOutcome = targetOutcome.trim();
    if (objectives !== undefined) project.objectives = Array.isArray(objectives) ? objectives : [objectives];
    if (expectedDeliverables !== undefined)
      project.expectedDeliverables = Array.isArray(expectedDeliverables) ? expectedDeliverables : [expectedDeliverables];
    if (startDate !== undefined) project.startDate = startDate;
    if (targetCompletionDate !== undefined) {
      project.targetCompletionDate = targetCompletionDate;
      project.deadline = targetCompletionDate;
    } else if (deadline) {
      project.deadline = deadline;
      if (!project.targetCompletionDate) project.targetCompletionDate = deadline;
    }
    if (priority) project.priority = priority;
    if (status) project.status = status;
    if (department) project.department = department.trim();
    if (team !== undefined) project.team = team.trim();

    if (directorId) {
      const directorUser = await User.findOne({ _id: directorId, organizationId: orgId });
      if (directorUser) {
        project.directorId = directorUser._id;
        project.directorName = `${directorUser.firstName} ${directorUser.lastName}`.trim();
      }
    }

    await project.save();

    const populated = await Project.findById(project._id).populate(
      "directorId",
      "firstName lastName email designation department"
    );

    const metrics = await calculateProjectMetrics(populated, orgId);

    res.json({
      message: "Project updated successfully",
      project: {
        ...populated.toObject(),
        metrics,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// POST /api/projects/:id/assign - Searchable multi-employee assignment with notifications
// -------------------------------------------------------------
router.post("/:id/assign", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const { employeeIds } = req.body;

    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "employeeIds array is required." });
    }

    const employees = await User.find({
      _id: { $in: employeeIds },
      ...orgCondition,
    }).select("firstName lastName email role designation team");

    project.assignedEmployees = employees.map((emp) => ({
      userId: emp._id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      email: emp.email,
      role: emp.role || "employee",
      designation: emp.designation || "",
      team: emp.team || "",
      assignedAt: new Date(),
    }));

    await project.save();

    // Send notifications to all assigned employees with duplicate prevention
    for (const emp of employees) {
      if (emp._id.toString() !== user.id.toString()) {
        await sendProjectNotification({
          userId: emp._id,
          organizationId: orgId,
          type: "project_assigned",
          title: `Project Assignment: ${project.name}`,
          message: `${user.firstName || "Admin"} assigned you to project "${project.name}". Target completion: ${
            project.targetCompletionDate || project.deadline || "TBD"
          }.`,
          link: `/dashboard?tab=tasks&projectId=${project._id}`,
          projectId: project._id,
        });
      }
    }

    res.json({
      message: `Assigned ${employees.length} employee(s) to project successfully.`,
      assignedEmployees: project.assignedEmployees,
    });
  } catch (error) {
    console.error("Assign project employees error:", error);
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// POST /api/projects/:id/milestones - Add milestone underneath project
// -------------------------------------------------------------
router.post("/:id/milestones", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const { title, description, deadline, dueDate, status, assignedEmployeeIds, phase } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Milestone title is required." });
    }

    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    let assignedToList = [];
    if (Array.isArray(assignedEmployeeIds) && assignedEmployeeIds.length > 0) {
      const emps = await User.find({
        _id: { $in: assignedEmployeeIds },
        ...orgCondition,
      }).select("firstName lastName email role designation team");

      assignedToList = emps.map((emp) => ({
        userId: emp._id,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.email,
        role: emp.role || "employee",
        designation: emp.designation || "",
        team: emp.team || "",
      }));
    }

    const newMilestone = {
      title: title.trim(),
      description: description ? description.trim() : "",
      deadline: deadline || dueDate || project.targetCompletionDate || project.deadline || "",
      dueDate: dueDate || deadline || "",
      status: status || "not-started",
      progress: 0,
      assignedTo: assignedToList,
      phase: phase || "",
      order: project.milestones.length,
      createdAt: new Date(),
    };

    project.milestones.push(newMilestone);
    await project.save();

    const createdMilestone = project.milestones[project.milestones.length - 1];

    // Notify assigned employees
    for (const emp of assignedToList) {
      if (emp.userId.toString() !== user.id.toString()) {
        await sendProjectNotification({
          userId: emp.userId,
          organizationId: orgId,
          type: "milestone_assigned",
          title: `Milestone Assignment: ${title}`,
          message: `${user.firstName || "Supervisor"} assigned you milestone "${title}" under project "${project.name}".`,
          link: `/dashboard?tab=tasks&projectId=${project._id}&milestoneId=${createdMilestone._id}`,
          projectId: project._id,
          milestoneId: createdMilestone._id,
        });
      }
    }

    const metrics = await calculateProjectMetrics(project, orgId);

    res.status(201).json({
      message: "Milestone added underneath project successfully",
      milestone: createdMilestone,
      metrics,
    });
  } catch (error) {
    console.error("Add milestone error:", error);
    res.status(400).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// PUT /api/projects/:id/milestones/:milestoneId - Update milestone & completion tracking
// -------------------------------------------------------------
router.put("/:id/milestones/:milestoneId", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };
    const {
      title,
      description,
      deadline,
      dueDate,
      status,
      progress,
      completed,
      submissionNotes,
      phase,
      weight,
      priority,
      approvalFeedback,
    } = req.body;

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found." });
    }

    if (title) milestone.title = title.trim();
    if (description !== undefined) milestone.description = description.trim();
    if (deadline !== undefined) milestone.deadline = deadline;
    if (dueDate !== undefined) milestone.dueDate = dueDate;
    if (submissionNotes !== undefined) milestone.submissionNotes = submissionNotes.trim();
    if (phase !== undefined) milestone.phase = phase;
    if (weight !== undefined) milestone.weight = Math.max(1, Math.min(5, Number(weight) || 1));
    if (priority !== undefined) milestone.priority = priority.toLowerCase();
    if (approvalFeedback !== undefined) milestone.approvalFeedback = approvalFeedback.trim();

    if (progress !== undefined) {
      milestone.progress = Math.max(0, Math.min(100, Number(progress)));
    }

    if (status !== undefined) {
      milestone.status = status;
      if (status === "completed") {
        milestone.completed = true;
        milestone.progress = 100;
        if (!milestone.completedAt) milestone.completedAt = new Date();
        milestone.completedBy = user.id;
        milestone.completedByName = `${user.firstName} ${user.lastName}`.trim();
      } else if (status === "submitted") {
        milestone.submittedAt = new Date();
        milestone.submissionCount = (milestone.submissionCount || 0) + 1;
      }
    }

    if (completed !== undefined) {
      milestone.completed = Boolean(completed);
      if (milestone.completed) {
        milestone.status = "completed";
        milestone.progress = 100;
        milestone.completedAt = new Date();
        milestone.completedBy = user.id;
        milestone.completedByName = `${user.firstName} ${user.lastName}`.trim();
      } else {
        if (milestone.status === "completed") {
          milestone.status = "in-progress";
        }
        milestone.completedAt = null;
        milestone.completedBy = null;
        milestone.completedByName = "";
      }
    }

    milestone.updatedAt = new Date();
    await project.save();

    // Synchronize mirror task deliverable if exists
    try {
      const linkedTask = await Task.findOne({
        projectId: project._id,
        $or: [
          { "milestones.id": milestone.id || milestone._id },
          { title: milestone.title },
        ],
      });
      if (linkedTask) {
        if (title) linkedTask.title = title.trim();
        if (description !== undefined) linkedTask.description = description.trim();
        if (deadline !== undefined) linkedTask.deadline = deadline;
        if (status !== undefined) linkedTask.status = milestone.status;
        if (progress !== undefined || completed !== undefined) linkedTask.progress = milestone.progress;
        if (weight !== undefined) linkedTask.weight = milestone.weight;
        if (priority !== undefined) linkedTask.priority = milestone.priority;
        if (milestone.completed) {
          linkedTask.status = "completed";
          linkedTask.progress = 100;
          linkedTask.approvedAt = milestone.completedAt;
          linkedTask.approvedBy = user.id;
        }
        await linkedTask.save();
      }
    } catch (syncErr) {
      console.warn("Could not sync mirror task deliverable:", syncErr.message);
    }

    const metrics = await calculateProjectMetrics(project, orgId);

    res.json({
      message: "Milestone updated successfully",
      milestone,
      metrics,
    });
  } catch (error) {
    console.error("Update milestone error:", error);
    res.status(400).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/projects/:id/milestones/:milestoneId - Remove milestone
// -------------------------------------------------------------
router.delete("/:id/milestones/:milestoneId", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };
    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    project.milestones.pull({ _id: req.params.milestoneId });
    await project.save();

    const metrics = await calculateProjectMetrics(project, orgId);

    res.json({ message: "Milestone deleted successfully", metrics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// POST /api/projects/:id/milestones/:milestoneId/assign - Assign employees to specific milestone
// -------------------------------------------------------------
router.post("/:id/milestones/:milestoneId/assign", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const { employeeIds } = req.body;

    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found." });
    }

    const employees = await User.find({
      _id: { $in: employeeIds || [] },
      ...orgCondition,
    }).select("firstName lastName email role designation team");

    milestone.assignedTo = employees.map((emp) => ({
      userId: emp._id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      email: emp.email,
      role: emp.role || "employee",
      designation: emp.designation || "",
      team: emp.team || "",
    }));

    await project.save();

    for (const emp of employees) {
      if (emp._id.toString() !== user.id.toString()) {
        await sendProjectNotification({
          userId: emp._id,
          organizationId: orgId,
          type: "milestone_assigned",
          title: `Milestone Assignment: ${milestone.title}`,
          message: `${user.firstName || "Supervisor"} assigned you milestone "${milestone.title}" under project "${project.name}".`,
          link: `/dashboard?tab=tasks&projectId=${project._id}&milestoneId=${milestone._id}`,
          projectId: project._id,
          milestoneId: milestone._id,
        });
      }
    }

    res.json({
      message: `Assigned ${employees.length} employee(s) to milestone.`,
      milestone,
    });
  } catch (error) {
    console.error("Assign milestone employees error:", error);
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// POST /api/projects/:id/recordings - Save voice recording to project or milestone
// -------------------------------------------------------------
router.post("/:id/recordings", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };
    const { audioUrl, durationSeconds, title, associatedMilestoneId, transcript, language } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ message: "audioUrl is required." });
    }

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const recording = {
      title: title || "Voice Note",
      audioUrl,
      durationSeconds: Number(durationSeconds) || 0,
      recordedBy: user.id,
      recordedByName: `${user.firstName} ${user.lastName}`.trim(),
      associatedMilestoneId: associatedMilestoneId || null,
      transcript: transcript || "",
      language: language || "en",
      createdAt: new Date(),
    };

    project.recordings.push(recording);
    await project.save();

    res.status(201).json({
      message: "Voice recording attached successfully",
      recording: project.recordings[project.recordings.length - 1],
    });
  } catch (error) {
    console.error("Save recording error:", error);
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/projects/:id/recordings/:recordingId - Delete recording
// -------------------------------------------------------------
router.delete("/:id/recordings/:recordingId", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };
    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    project.recordings.pull({ _id: req.params.recordingId });
    await project.save();

    res.json({ message: "Recording deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/projects/:id - Delete project and related tasks
// -------------------------------------------------------------
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const orgCondition = orgId
      ? { $or: [{ organizationId: orgId }, { companyName: user.companyName }] }
      : { companyName: user.companyName };

    const project = await Project.findOne({ _id: req.params.id, ...orgCondition });
    if (!project) {
      return res.status(404).json({ message: "Project not found in your organization." });
    }

    const hasPerm = user.role === "admin" || user.permissions?.canDeleteProjects;
    if (!hasPerm) {
      return res.status(403).json({ message: "Access denied. You do not have permission to delete projects." });
    }

    await Task.deleteMany({ projectId: project._id });
    await Project.findByIdAndDelete(project._id);

    res.json({ message: "Project and all associated tasks deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
