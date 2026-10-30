const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_task_manager_2026_secure";

// Helper to ensure an existing user has a linked Organization workspace
const ensureUserOrganization = async (user) => {
  if (user.organizationId) return user.organizationId;

  let org = await Organization.findOne({
    $or: [{ adminId: user._id }, { name: user.companyName }],
  });

  if (!org) {
    org = await Organization.create({
      name: user.companyName || "Organization Workspace",
      adminId: user._id,
    });
  }

  user.organizationId = org._id;
  await user.save();
  return org._id;
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User account no longer exists." });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        message: "Your account has been disabled. Please contact your workspace administrator.",
      });
    }

    // Ensure organizationId is always resolved and present
    const organizationId = await ensureUserOrganization(user);

    // Provide standard permissions for admin role if not explicitly set
    let permissions = user.permissions ? (user.permissions.toObject ? user.permissions.toObject() : user.permissions) : {};
    if (user.role === "admin") {
      permissions = {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditTasks: true,
        canApproveTasks: true,
        canDeleteTasks: true,
        canViewTasks: true,
        canManageEmployees: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewProjects: true,
        canManageStructure: true,
        canViewExecutiveSummary: true,
        canApproveWork: true,
        canViewTeamTasks: true,
        canViewAllTasks: true,
      };
    }

    let accessScopes = user.accessScopes ? (user.accessScopes.toObject ? user.accessScopes.toObject() : user.accessScopes) : {};
    if (user.role === "admin") {
      accessScopes = {
        taskScope: "company",
        projectScope: "company",
        employeeScope: "company",
        reportScope: "company",
      };
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      designation: user.designation,
      role: user.role || "employee",
      department: user.department || "General",
      team: user.team || "",
      teamId: user.teamId || "",
      positionTitle: user.positionTitle || user.designation,
      hierarchyLevel: user.hierarchyLevel || 4,
      organizationId: organizationId,
      permissions,
      accessScopes,
      reportingRelationships: user.reportingRelationships || [],
      reportsTo: user.reportsTo,
      employeeId: user.employeeId || "",
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = authMiddleware;
