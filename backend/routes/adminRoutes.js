const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const Project = require("../models/Project");
const Task = require("../models/Task");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Middleware: Require Admin or Manager role
const requireAdminOrManager = (req, res, next) => {
  const role = req.user.role || "admin";
  if (role !== "admin" && role !== "manager") {
    return res.status(403).json({
      message: "Access forbidden. Only authorized administrators or managers can perform this action.",
    });
  }
  next();
};

// GET /api/admin/summary - Executive Head of Office Summary View
// Calculates high-level project KPIs without exposing micro-task details by default
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("directorId", "firstName lastName email designation department")
      .sort({ createdAt: -1 });

    const today = new Date().toISOString().split("T")[0];
    let totalProgressSum = 0;
    let onTrackCount = 0;
    let delayedCount = 0;
    let completedProjectsCount = 0;

    const projectSummaries = await Promise.all(
      projects.map(async (p) => {
        const tasks = await Task.find({ projectId: p._id });
        const totalTasks = tasks.length;

        let totalWeight = 0;
        let weightedProgress = 0;
        let completedCount = 0;
        let overdueCount = 0;

        for (const t of tasks) {
          const weight = t.weight || 1;
          totalWeight += weight;
          const prog = t.status === "completed" ? 100 : t.progress || 0;
          weightedProgress += weight * prog;

          if (t.status === "completed") completedCount++;
          if (t.deadline && t.deadline < today && t.status !== "completed") {
            overdueCount++;
          }
        }

        const progressPercentage = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
        totalProgressSum += progressPercentage;

        let calculatedStatus = "on-track";
        if (totalTasks > 0 && completedCount === totalTasks) {
          calculatedStatus = "completed";
          completedProjectsCount++;
        } else if (overdueCount > 0 || (p.deadline && p.deadline < today)) {
          calculatedStatus = "delayed";
          delayedCount++;
        } else if (progressPercentage === 0) {
          calculatedStatus = "not-started";
        } else {
          onTrackCount++;
        }

        const directorName = p.directorId
          ? `${p.directorId.firstName} ${p.directorId.lastName}`
          : p.directorName || "Unassigned";

        return {
          id: p._id,
          name: p.name,
          targetOutcome: p.targetOutcome,
          directorName,
          directorEmail: p.directorId?.email,
          deadline: p.deadline,
          status: calculatedStatus,
          progressPercentage,
          completedTasks: completedCount,
          totalTasks,
          overdueTasks: overdueCount,
        };
      })
    );

    const averageProgress =
      projects.length > 0 ? Math.round(totalProgressSum / projects.length) : 0;

    res.json({
      totalProjects: projects.length,
      averageProgress,
      onTrackProjects: onTrackCount,
      delayedProjects: delayedCount,
      completedProjects: completedProjectsCount,
      projectSummaries,
    });
  } catch (error) {
    console.error("Admin summary error:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/hierarchy - Organizational reporting hierarchy tree
router.get("/hierarchy", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ status: "active" })
      .select("firstName lastName email role designation department reportsTo positionTitle hierarchyLevel permissions")
      .populate("reportsTo", "firstName lastName role designation positionTitle hierarchyLevel");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/admin/hierarchy/assign-supervisor - Dynamic supervisor assignment
router.patch("/hierarchy/assign-supervisor", authMiddleware, requireAdminOrManager, async (req, res) => {
  try {
    const { employeeId, supervisorId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required." });
    }

    if (employeeId === supervisorId) {
      return res.status(400).json({ message: "An employee cannot report to themselves." });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    employee.reportsTo = supervisorId || null;
    await employee.save();

    res.json({
      message: "Reporting relationship updated successfully",
      employee,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/directors - Eligible Project Directors, Leaders, and Managers
router.get("/directors", authMiddleware, async (req, res) => {
  try {
    const eligible = await User.find({
      status: "active",
      $or: [
        { role: { $in: ["admin", "director", "manager"] } },
        { hierarchyLevel: { $lte: 2 } },
        { "permissions.canCreateProjects": true },
      ],
    }).select("firstName lastName email role designation department positionTitle hierarchyLevel");

    res.json(eligible);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/employees/invite
// Generate a secure single-use invitation with 24-hour expiration
router.post("/employees/invite", authMiddleware, requireAdminOrManager, async (req, res) => {
  try {
    const { name, email, department, role, positionTitle, hierarchyLevel, permissions } = req.body;

    if (!name || !email || !department || !role) {
      return res.status(400).json({
        message: "Please provide employee name, official email, department, and role.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify employee role (Never allow frontend to assign admin!)
    if (role.toLowerCase() === "admin") {
      return res.status(400).json({
        message: "Cannot assign 'admin' role through employee invitation.",
      });
    }

    // Check if an active user with this email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "A user with this official email already exists in the system.",
      });
    }

    // Generate cryptographically random 32-byte single-use token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 24-hour expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Revoke any previous pending invitations for this email
    await Invitation.updateMany(
      { email: normalizedEmail, status: "pending" },
      { status: "revoked" }
    );

    const invitation = await Invitation.create({
      name: name.trim(),
      email: normalizedEmail,
      department: department.trim(),
      role,
      positionTitle: positionTitle || `${department.trim()} ${role === "manager" ? "Manager" : "Specialist"}`,
      hierarchyLevel: Number(hierarchyLevel) || (role === "director" ? 2 : role === "manager" ? 3 : 4),
      permissions: permissions || {},
      companyName: req.user.companyName || "Company",
      tokenHash,
      status: "pending",
      expiresAt,
      invitedBy: req.user.id,
    });

    res.status(201).json({
      message: "Secure invitation generated successfully.",
      invitation: {
        id: invitation._id,
        name: invitation.name,
        email: invitation.email,
        department: invitation.department,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
      inviteToken: rawToken,
    });
  } catch (error) {
    console.error("Invite error:", error);
    res.status(500).json({ message: error.message || "Failed to create invitation" });
  }
});

// GET /api/admin/employees
router.get("/employees", authMiddleware, async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("reportsTo", "firstName lastName role designation")
      .sort({ createdAt: -1 });

    const pendingInvites = await Invitation.find({ status: "pending" }).sort({ createdAt: -1 });

    res.json({
      employees: users,
      pendingInvitations: pendingInvites,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/admin/employees/:id
router.patch("/employees/:id", authMiddleware, requireAdminOrManager, async (req, res) => {
  try {
    const { role, department, designation, reportsTo, positionTitle, hierarchyLevel, permissions } = req.body;
    const updateData = {};

    if (role) {
      updateData.role = role;
    }
    if (department) {
      updateData.department = department.trim();
    }
    if (designation) {
      updateData.designation = designation.trim();
    }
    if (positionTitle) {
      updateData.positionTitle = positionTitle.trim();
    }
    if (hierarchyLevel !== undefined) {
      updateData.hierarchyLevel = Number(hierarchyLevel);
    }
    if (permissions) {
      updateData.permissions = permissions;
    }
    if (reportsTo !== undefined) {
      updateData.reportsTo = reportsTo || null;
    }

    const employee = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select("-password");
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.json({ message: "Employee updated successfully", employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/employees/:id/disable
router.post("/employees/:id/disable", authMiddleware, requireAdminOrManager, async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    if (employee.role === "admin" && employee._id.toString() === req.user.id) {
      return res.status(400).json({ message: "Admin cannot disable their own account." });
    }

    employee.status = employee.status === "active" ? "disabled" : "active";
    await employee.save();

    res.json({
      message: `Employee account ${employee.status === "active" ? "activated" : "disabled"} successfully.`,
      status: employee.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
