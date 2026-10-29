const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const Project = require("../models/Project");
const Task = require("../models/Task");
const authMiddleware = require("../middleware/auth");
const { detectCircularReporting, requirePermission } = require("../middleware/rbac");

const router = express.Router();

// Middleware: Require Admin role or canManageEmployees permission
const requireAdminOrEmployeeManager = (req, res, next) => {
  const user = req.user;
  if (user.role === "admin" || user.permissions?.canManageEmployees) {
    return next();
  }
  return res.status(403).json({
    message: "Access forbidden. Only authorized administrators or employee managers can perform this action.",
  });
};

// GET /api/admin/summary - Executive Head of Office Summary View
// Strict multi-company data isolation: filters exclusively by user's organizationId
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "admin" && !user.permissions?.canViewExecutiveSummary) {
      return res.status(403).json({ message: "Access forbidden. You do not have permission to view executive summary." });
    }

    const orgId = user.organizationId;

    const projects = await Project.find({ organizationId: orgId })
      .populate("directorId", "firstName lastName email designation department")
      .sort({ createdAt: -1 });

    const today = new Date().toISOString().split("T")[0];
    let totalProgressSum = 0;
    let onTrackCount = 0;
    let delayedCount = 0;
    let completedProjectsCount = 0;

    const projectSummaries = await Promise.all(
      projects.map(async (p) => {
        const tasks = await Task.find({ projectId: p._id, organizationId: orgId });
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

    const averageProgress = projects.length > 0 ? Math.round(totalProgressSum / projects.length) : 0;

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

// GET /api/admin/hierarchy - Organizational reporting hierarchy tree (multi-company scoped)
router.get("/hierarchy", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const users = await User.find({ organizationId: orgId, status: "active" })
      .select("firstName lastName email role designation department team teamId reportsTo reportingRelationships positionTitle hierarchyLevel permissions accessScopes")
      .populate("reportsTo", "firstName lastName role designation positionTitle hierarchyLevel")
      .populate("reportingRelationships.managerId", "firstName lastName role designation positionTitle hierarchyLevel");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/admin/hierarchy/assign-supervisor - Legacy supervisor assignment with circular detection
router.patch("/hierarchy/assign-supervisor", authMiddleware, requireAdminOrEmployeeManager, async (req, res) => {
  try {
    const { employeeId, supervisorId, relationshipType = "direct" } = req.body;
    const orgId = req.user.organizationId;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required." });
    }

    const employee = await User.findOne({ _id: employeeId, organizationId: orgId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found in your organization." });
    }

    if (supervisorId) {
      const supervisor = await User.findOne({ _id: supervisorId, organizationId: orgId });
      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found in your organization." });
      }

      // Circular reporting validation
      const cycleCheck = await detectCircularReporting(employeeId, supervisorId, orgId);
      if (cycleCheck.hasCycle) {
        return res.status(400).json({ message: cycleCheck.message });
      }

      employee.reportsTo = supervisorId;
      // Update reportingRelationships array
      const existingRelIndex = (employee.reportingRelationships || []).findIndex(
        (r) => r.managerId && r.managerId.toString() === supervisorId.toString()
      );

      if (existingRelIndex >= 0) {
        employee.reportingRelationships[existingRelIndex].relationshipType = relationshipType;
      } else {
        // Replace or add direct manager
        const nonDirect = (employee.reportingRelationships || []).filter(
          (r) => r.relationshipType !== "direct"
        );
        employee.reportingRelationships = [
          { managerId: supervisorId, relationshipType: "direct", assignedAt: new Date() },
          ...nonDirect,
        ];
      }
    } else {
      employee.reportsTo = null;
      employee.reportingRelationships = (employee.reportingRelationships || []).filter(
        (r) => r.relationshipType !== "direct"
      );
    }

    await employee.save();

    const populated = await User.findById(employee._id)
      .populate("reportsTo", "firstName lastName role designation")
      .populate("reportingRelationships.managerId", "firstName lastName role designation");

    res.json({
      message: "Reporting relationship updated successfully",
      employee: populated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/hierarchy/managers - Multiple managers configuration with relationship types
router.post("/hierarchy/managers", authMiddleware, requireAdminOrEmployeeManager, async (req, res) => {
  try {
    const { employeeId, relationships } = req.body;
    const orgId = req.user.organizationId;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required." });
    }

    if (!Array.isArray(relationships)) {
      return res.status(400).json({ message: "Relationships must be an array of { managerId, relationshipType }." });
    }

    const employee = await User.findOne({ _id: employeeId, organizationId: orgId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found in your organization." });
    }

    // Verify all managers belong to the same organization and detect circular relationships
    const managerIds = [];
    const sanitizedRelationships = [];

    for (const rel of relationships) {
      const mgrId = rel.managerId || rel._id || rel.id;
      if (!mgrId) continue;

      const mgr = await User.findOne({ _id: mgrId, organizationId: orgId });
      if (!mgr) {
        return res.status(400).json({ message: `Manager ID ${mgrId} not found in this company.` });
      }

      managerIds.push(mgrId);
      sanitizedRelationships.push({
        managerId: mgr._id,
        relationshipType: ["direct", "project", "functional"].includes(rel.relationshipType)
          ? rel.relationshipType
          : "direct",
        assignedAt: rel.assignedAt || new Date(),
      });
    }

    // Validate circular reporting dependencies
    const cycleCheck = await detectCircularReporting(employeeId, managerIds, orgId);
    if (cycleCheck.hasCycle) {
      return res.status(400).json({ message: cycleCheck.message });
    }

    employee.reportingRelationships = sanitizedRelationships;

    // Synchronize reportsTo with the first direct manager (or first manager in list)
    const directRel = sanitizedRelationships.find((r) => r.relationshipType === "direct");
    employee.reportsTo = directRel ? directRel.managerId : (sanitizedRelationships[0]?.managerId || null);

    await employee.save();

    const populated = await User.findById(employee._id)
      .populate("reportsTo", "firstName lastName role designation")
      .populate("reportingRelationships.managerId", "firstName lastName role designation positionTitle");

    res.json({
      message: "Reporting relationships updated successfully",
      employee: populated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/directors - Eligible Project Directors and Leaders (company scoped)
router.get("/directors", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const eligible = await User.find({
      organizationId: orgId,
      status: "active",
      $or: [
        { role: { $in: ["admin", "director", "manager"] } },
        { hierarchyLevel: { $lte: 3 } },
        { "permissions.canCreateProjects": true },
      ],
    }).select("firstName lastName email role designation department team positionTitle hierarchyLevel");

    res.json(eligible);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/employees/invite - Generate single-use invitation scoped to company
router.post("/employees/invite", authMiddleware, requireAdminOrEmployeeManager, async (req, res) => {
  try {
    const {
      name,
      email,
      department,
      team,
      role,
      positionTitle,
      hierarchyLevel,
      permissions,
      accessScopes,
      reportingRelationships,
      reportsTo,
    } = req.body;

    if (!name || !email || !department || !role) {
      return res.status(400).json({
        message: "Please provide employee name, official email, department, and role.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Prevent granting admin role via regular invitation
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

    const orgId = req.user.organizationId;

    // Generate cryptographically random token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiration

    // Revoke any previous pending invitations for this email
    await Invitation.updateMany(
      { email: normalizedEmail, status: "pending" },
      { status: "revoked" }
    );

    let initialRelationships = [];
    if (Array.isArray(reportingRelationships) && reportingRelationships.length > 0) {
      initialRelationships = reportingRelationships;
    } else if (reportsTo) {
      initialRelationships = [{ managerId: reportsTo, relationshipType: "direct" }];
    }

    const invitation = await Invitation.create({
      name: name.trim(),
      email: normalizedEmail,
      department: department.trim(),
      team: team ? team.trim() : "",
      role,
      positionTitle: positionTitle || `${department.trim()} ${role === "manager" ? "Manager" : "Specialist"}`,
      hierarchyLevel: Number(hierarchyLevel) || (role === "director" ? 2 : role === "manager" ? 3 : 4),
      permissions: permissions || {},
      accessScopes: accessScopes || {
        taskScope: role === "director" ? "project" : role === "manager" ? "team" : "own",
        projectScope: "project",
        employeeScope: role === "director" ? "department" : role === "manager" ? "team" : "own",
        reportScope: "own",
      },
      reportingRelationships: initialRelationships,
      companyName: req.user.companyName || "Company",
      organizationId: orgId,
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
        team: invitation.team,
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

// GET /api/admin/employees - List employees and invitations (company-scoped)
router.get("/employees", authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organizationId;

    const users = await User.find({ organizationId: orgId })
      .select("-password")
      .populate("reportsTo", "firstName lastName role designation")
      .populate("reportingRelationships.managerId", "firstName lastName role designation positionTitle")
      .sort({ createdAt: -1 });

    const allInvites = await Invitation.find({ organizationId: orgId }).sort({ createdAt: -1 });

    const now = new Date();
    const formattedInvites = allInvites.map((inv) => {
      const isExpired = inv.status === "pending" && inv.expiresAt && new Date(inv.expiresAt) < now;
      return {
        _id: inv._id,
        id: inv._id,
        name: inv.name,
        email: inv.email,
        department: inv.department,
        team: inv.team,
        role: inv.role,
        positionTitle: inv.positionTitle,
        hierarchyLevel: inv.hierarchyLevel,
        status: isExpired ? "expired" : inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        isExpired,
      };
    });

    const pendingInvites = formattedInvites.filter((i) => i.status === "pending");

    res.json({
      employees: users,
      pendingInvitations: pendingInvites,
      allInvitations: formattedInvites,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/invitations/:id/resend - Resend an invitation with a fresh token and 24h expiration
router.post("/invitations/:id/resend", authMiddleware, requireAdminOrEmployeeManager, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const invitation = await Invitation.findOne({ _id: req.params.id, organizationId: orgId });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found." });
    }

    if (invitation.status === "accepted") {
      return res.status(400).json({ message: "This invitation has already been accepted." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day renewal

    invitation.tokenHash = tokenHash;
    invitation.status = "pending";
    invitation.expiresAt = expiresAt;
    await invitation.save();

    res.json({
      message: `Invitation resent successfully to ${invitation.email}.`,
      invitation: {
        id: invitation._id,
        _id: invitation._id,
        name: invitation.name,
        email: invitation.email,
        department: invitation.department,
        team: invitation.team,
        role: invitation.role,
        status: "pending",
        expiresAt: invitation.expiresAt,
      },
      inviteToken: rawToken,
    });
  } catch (error) {
    console.error("Resend invite error:", error);
    res.status(500).json({ message: error.message || "Failed to resend invitation." });
  }
});

// POST /api/admin/invitations/:id/revoke - Revoke an invitation
router.post("/invitations/:id/revoke", authMiddleware, requireAdminOrEmployeeManager, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const invitation = await Invitation.findOne({ _id: req.params.id, organizationId: orgId });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found." });
    }

    if (invitation.status === "accepted") {
      return res.status(400).json({ message: "Cannot revoke an invitation that has already been accepted." });
    }

    invitation.status = "revoked";
    await invitation.save();

    res.json({
      message: `Invitation for ${invitation.email} has been revoked.`,
      invitation: {
        id: invitation._id,
        _id: invitation._id,
        name: invitation.name,
        email: invitation.email,
        status: "revoked",
      },
    });
  } catch (error) {
    console.error("Revoke invite error:", error);
    res.status(500).json({ message: error.message || "Failed to revoke invitation." });
  }
});

// PATCH /api/admin/employees/:id - Update employee role, department, team, permissions, scopes & managers
router.patch("/employees/:id", authMiddleware, requireAdminOrEmployeeManager, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const employee = await User.findOne({ _id: req.params.id, organizationId: orgId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found in your organization." });
    }

    const {
      role,
      department,
      team,
      teamId,
      designation,
      positionTitle,
      hierarchyLevel,
      permissions,
      accessScopes,
      reportingRelationships,
      reportsTo,
    } = req.body;

    if (role) employee.role = role;
    if (department) employee.department = department.trim();
    if (team !== undefined) employee.team = team.trim();
    if (teamId !== undefined) employee.teamId = teamId.trim();
    if (designation) employee.designation = designation.trim();
    if (positionTitle) employee.positionTitle = positionTitle.trim();
    if (hierarchyLevel !== undefined) employee.hierarchyLevel = Number(hierarchyLevel);
    if (permissions) employee.permissions = { ...employee.permissions, ...permissions };
    if (accessScopes) employee.accessScopes = { ...employee.accessScopes, ...accessScopes };

    // Update managers if provided
    if (reportingRelationships !== undefined && Array.isArray(reportingRelationships)) {
      const managerIds = reportingRelationships.map((r) => r.managerId || r._id || r.id).filter(Boolean);
      const cycleCheck = await detectCircularReporting(employee._id, managerIds, orgId);
      if (cycleCheck.hasCycle) {
        return res.status(400).json({ message: cycleCheck.message });
      }

      employee.reportingRelationships = reportingRelationships.map((r) => ({
        managerId: r.managerId || r._id || r.id,
        relationshipType: ["direct", "project", "functional"].includes(r.relationshipType)
          ? r.relationshipType
          : "direct",
        assignedAt: r.assignedAt || new Date(),
      }));

      const directRel = employee.reportingRelationships.find((r) => r.relationshipType === "direct");
      employee.reportsTo = directRel ? directRel.managerId : (employee.reportingRelationships[0]?.managerId || null);
    } else if (reportsTo !== undefined) {
      if (reportsTo) {
        const cycleCheck = await detectCircularReporting(employee._id, reportsTo, orgId);
        if (cycleCheck.hasCycle) {
          return res.status(400).json({ message: cycleCheck.message });
        }
        employee.reportsTo = reportsTo;
        employee.reportingRelationships = [
          { managerId: reportsTo, relationshipType: "direct", assignedAt: new Date() },
        ];
      } else {
        employee.reportsTo = null;
        employee.reportingRelationships = [];
      }
    }

    await employee.save();

    const updated = await User.findById(employee._id)
      .select("-password")
      .populate("reportsTo", "firstName lastName role designation")
      .populate("reportingRelationships.managerId", "firstName lastName role designation positionTitle");

    res.json({ message: "Employee updated successfully", employee: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/employees/:id/disable - Toggle employee account status
router.post("/employees/:id/disable", authMiddleware, requireAdminOrEmployeeManager, async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const employee = await User.findOne({ _id: req.params.id, organizationId: orgId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found in your organization." });
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
