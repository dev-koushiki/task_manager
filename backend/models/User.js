const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
    },
    department: {
      type: String,
      default: "General",
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "director", "manager", "employee"],
      default: "admin",
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    positionTitle: {
      type: String,
      default: "",
      trim: true,
    },
    hierarchyLevel: {
      type: Number,
      default: 1,
    },
    permissions: {
      canCreateProjects: { type: Boolean, default: false },
      canAssignTasks: { type: Boolean, default: false },
      canApproveWork: { type: Boolean, default: false },
      canViewExecutiveSummary: { type: Boolean, default: false },
      canViewTeamTasks: { type: Boolean, default: false },
      canViewAllTasks: { type: Boolean, default: false },
      canManageStructure: { type: Boolean, default: false },
    },
    reportsTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
