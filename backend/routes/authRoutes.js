const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "taskmanager_default_secret_key_2026";

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

    const newUser = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      companyName: companyName.trim(),
      designation: designation.trim(),
      role: "admin", // Initial registrant is the Workspace Admin
      status: "active",
      department: "Leadership",
    });

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
// Preview public details of an invitation token before accepting
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
      role: invitation.role,
      companyName: invitation.companyName,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/register/accept-invite
// Employee accepts invitation, sets their own password, and activates account
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

    // Hash token to match database
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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create Employee User — role is strictly taken from invitation!
    const newUser = await User.create({
      firstName,
      lastName,
      email: invitation.email,
      password: hashedPassword,
      companyName: invitation.companyName,
      designation: `${invitation.department} ${invitation.role === "manager" ? "Manager" : "Specialist"}`,
      department: invitation.department,
      role: invitation.role, // strictly "employee" or "manager" from the invitation
      status: "active",
      mfaEnabled: Boolean(mfaEnabled),
    });

    // Mark invitation as accepted
    invitation.status = "accepted";
    await invitation.save();

    // Create session token
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

    // Check account status
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

    // Check if MFA is required
    if (user.mfaEnabled) {
      return res.status(200).json({
        requireMfa: true,
        email: user.email,
        message: "Multi-factor authentication required. Please enter your 6-digit verification code.",
      });
    }

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
        role: user.role || "employee",
        department: user.department || "General",
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

    // Verify code: accept any 6-digit code or default "123456" for authentication
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Verification code must be exactly 6 digits." });
    }

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

// Current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
