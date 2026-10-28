const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const Organization = require("../models/Organization");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
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

// Initial Admin / Workspace Registration
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, companyName, designation } = req.body;

    if (!firstName || !lastName || !email || !password || !companyName || !designation) {
      return res.status(400).json({
        message: "Please fill in all required fields.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email address already exists. Please log in.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create Organization workspace for company
    const newOrg = await Organization.create({
      name: companyName.trim(),
    });

    const adminPermissions = {
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

    const adminScopes = {
      taskScope: "company",
      projectScope: "company",
      employeeScope: "company",
      reportScope: "company",
    };

    const newUser = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      companyName: companyName.trim(),
      designation: designation.trim(),
      role: "admin", // Initial registrant is the Workspace Admin
      organizationId: newOrg._id,
      positionTitle: designation.trim() || "Chief Executive / Administrator",
      hierarchyLevel: 1,
      permissions: adminPermissions,
      accessScopes: adminScopes,
      reportingRelationships: [],
      reportsTo: null,
      status: "active",
      department: "Executive Leadership",
    });

    // Link org adminId
    newOrg.adminId = newUser._id;
    await newOrg.save();

    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        companyName: newUser.companyName,
        designation: newUser.designation,
        role: newUser.role,
        department: newUser.department,
        team: newUser.team,
        positionTitle: newUser.positionTitle,
        hierarchyLevel: newUser.hierarchyLevel,
        organizationId: newOrg._id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Admin workspace account created successfully!",
      token,
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        companyName: newUser.companyName,
        designation: newUser.designation,
        role: newUser.role,
        department: newUser.department,
        team: newUser.team,
        positionTitle: newUser.positionTitle,
        hierarchyLevel: newUser.hierarchyLevel,
        permissions: newUser.permissions,
        accessScopes: newUser.accessScopes,
        reportingRelationships: newUser.reportingRelationships,
        organizationId: newOrg._id,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      message: error.code === 11000 ? "This email is already registered." : error.message || "Registration failed.",
    });
  }
});

// GET /api/auth/invite-details/:token
router.get("/invite-details/:token", async (req, res) => {
  try {
    const rawToken = req.params.token;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const invitation = await Invitation.findOne({
      tokenHash,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(404).json({
        message: "This invitation link is invalid or has expired. Please contact your workspace administrator.",
      });
    }

    res.json({
      name: invitation.name,
      email: invitation.email,
      department: invitation.department,
      team: invitation.team,
      role: invitation.role,
      companyName: invitation.companyName,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/register/accept-invite
router.post("/register/accept-invite", async (req, res) => {
  try {
    const { inviteToken, password, confirmPassword, mfaEnabled } = req.body;

    if (!inviteToken || !password) {
      return res.status(400).json({ message: "Invite token and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");

    const invitation = await Invitation.findOne({
      tokenHash,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(400).json({
        message: "This invitation link is invalid, expired, or already used. Please request a new invitation from your admin.",
      });
    }

    // Derive name parts
    const nameParts = invitation.name.trim().split(" ");
    const firstName = nameParts[0] || invitation.name;
    const lastName = nameParts.slice(1).join(" ") || "Employee";

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const role = invitation.role || "employee";
    const level = invitation.hierarchyLevel || (role === "director" ? 2 : role === "manager" ? 3 : 4);
    const positionTitle = invitation.positionTitle || `${invitation.department} ${role === "manager" ? "Manager" : "Specialist"}`;

    const defaultPermissions = {
      canCreateTasks: role === "director" || role === "manager" || role === "admin",
      canAssignTasks: role === "director" || role === "manager" || role === "admin",
      canEditTasks: role === "director" || role === "manager" || role === "admin",
      canApproveTasks: role === "director" || role === "manager" || role === "admin",
      canDeleteTasks: role === "admin",
      canViewTasks: true,
      canManageEmployees: role === "admin",
      canCreateProjects: role === "director" || role === "admin",
      canEditProjects: role === "director" || role === "admin",
      canDeleteProjects: role === "admin",
      canViewProjects: true,
      canManageStructure: role === "admin",
      canViewExecutiveSummary: role === "director" || role === "admin",
      canApproveWork: role === "director" || role === "manager" || role === "admin",
      canViewTeamTasks: role === "director" || role === "manager" || role === "admin",
      canViewAllTasks: role === "admin",
    };

    const userPermissions = {
      ...defaultPermissions,
      ...(invitation.permissions || {}),
    };

    const userScopes = invitation.accessScopes || {
      taskScope: role === "director" ? "project" : role === "manager" ? "team" : "own",
      projectScope: "project",
      employeeScope: role === "director" ? "department" : role === "manager" ? "team" : "own",
      reportScope: "own",
    };

    // Resolve organizationId
    let orgId = invitation.organizationId;
    if (!orgId) {
      const org = await Organization.findOne({ name: invitation.companyName });
      orgId = org ? org._id : null;
    }

    const newUser = await User.create({
      firstName,
      lastName,
      email: invitation.email,
      password: hashedPassword,
      companyName: invitation.companyName,
      organizationId: orgId,
      designation: positionTitle,
      department: invitation.department,
      team: invitation.team || "",
      role,
      positionTitle,
      hierarchyLevel: level,
      permissions: userPermissions,
      accessScopes: userScopes,
      reportingRelationships: Array.isArray(invitation.reportingRelationships) ? invitation.reportingRelationships : [],
      status: "active",
      mfaEnabled: Boolean(mfaEnabled),
    });

    invitation.status = "accepted";
    await invitation.save();

    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        companyName: newUser.companyName,
        designation: newUser.designation,
        role: newUser.role,
        department: newUser.department,
        team: newUser.team,
        positionTitle: newUser.positionTitle,
        hierarchyLevel: newUser.hierarchyLevel,
        organizationId: newUser.organizationId,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Employee account successfully created and activated!",
      token,
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        companyName: newUser.companyName,
        designation: newUser.designation,
        role: newUser.role,
        department: newUser.department,
        team: newUser.team,
        positionTitle: newUser.positionTitle,
        hierarchyLevel: newUser.hierarchyLevel,
        permissions: newUser.permissions,
        accessScopes: newUser.accessScopes,
        reportingRelationships: newUser.reportingRelationships,
        organizationId: newUser.organizationId,
        mfaEnabled: newUser.mfaEnabled,
      },
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    res.status(500).json({ message: error.message || "Failed to activate employee account." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide both email and password.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        message: "This account has been disabled by the administrator. Please contact your workspace admin.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (user.mfaEnabled) {
      return res.status(200).json({
        requireMfa: true,
        email: user.email,
        message: "Multi-factor authentication required. Please enter your 6-digit verification code.",
      });
    }

    // Ensure user has linked organizationId
    const organizationId = await ensureUserOrganization(user);

    const role = user.role || "employee";
    const level = user.hierarchyLevel || (role === "admin" ? 1 : role === "director" ? 2 : role === "manager" ? 3 : 4);
    const positionTitle = user.positionTitle || user.designation;

    let permissions = user.permissions ? (user.permissions.toObject ? user.permissions.toObject() : user.permissions) : {};
    if (role === "admin") {
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
    if (role === "admin") {
      accessScopes = {
        taskScope: "company",
        projectScope: "company",
        employeeScope: "company",
        reportScope: "company",
      };
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        designation: user.designation,
        role,
        department: user.department || "General",
        team: user.team || "",
        positionTitle,
        hierarchyLevel: level,
        organizationId,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        companyName: user.companyName,
        designation: user.designation,
        role,
        department: user.department || "General",
        team: user.team || "",
        positionTitle,
        hierarchyLevel: level,
        permissions,
        accessScopes,
        reportingRelationships: user.reportingRelationships || [],
        reportsTo: user.reportsTo,
        organizationId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: error.message || "Server error during login.",
    });
  }
});

// POST /api/auth/mfa/verify
router.post("/mfa/verify", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Email and verification code are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Verification code must be exactly 6 digits." });
    }

    const organizationId = await ensureUserOrganization(user);

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        designation: user.designation,
        role: user.role || "employee",
        department: user.department || "General",
        organizationId,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "MFA verified successfully! Welcome to your dashboard.",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        companyName: user.companyName,
        designation: user.designation,
        role: user.role || "employee",
        department: user.department || "General",
        team: user.team || "",
        permissions: user.permissions,
        accessScopes: user.accessScopes,
        organizationId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, (req, res) => {
  res.json({ message: "Logged out successfully. Session invalidated." });
});

// GET /api/auth/me - Current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("reportsTo", "firstName lastName role designation")
      .populate("reportingRelationships.managerId", "firstName lastName role designation positionTitle");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
