const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
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

// POST /api/admin/employees/invite
// Generate a secure single-use invitation with 24-hour expiration
router.post("/employees/invite", authMiddleware, requireAdminOrManager, async (req, res) => {
  try {
    const { name, email, department, role } = req.body;

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
      inviteToken: rawToken, // Single-use token returned to admin / link generator
    });
  } catch (error) {
    console.error("Invite error:", error);
    res.status(500).json({ message: error.message || "Failed to create invitation" });
  }
});

// GET /api/admin/employees
// Retrieve all employees and active/pending invitations
router.get("/employees", authMiddleware, async (req, res) => {
  try {
    // 1. Get registered users in this company
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    // 2. Get pending invitations
    const pendingInvites = await Invitation.find({ status: "pending" })
      .sort({ createdAt: -1 });

    res.json({
      employees: users,
      pendingInvitations: pendingInvites,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/admin/employees/:id
// Update employee role or department
router.patch("/employees/:id", authMiddleware, requireAdminOrManager, async (req, res) => {
  try {
    const { role, department } = req.body;
    const updateData = {};

    if (role) {
      if (role.toLowerCase() === "admin") {
        return res.status(400).json({ message: "Cannot elevate to admin role." });
      }
      updateData.role = role;
    }
    if (department) {
      updateData.department = department.trim();
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
// Toggle account status (active <-> disabled)
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
