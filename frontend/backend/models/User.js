const mongoose = require("mongoose");

const reportingRelationshipSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    relationshipType: {
      type: String,
      enum: ["direct", "project", "functional"],
      default: "direct",
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const permissionsSchema = new mongoose.Schema(
  {
    canCreateTasks: { type: Boolean, default: false },
    canAssignTasks: { type: Boolean, default: false },
    canEditTasks: { type: Boolean, default: false },
    canApproveTasks: { type: Boolean, default: false },
    canDeleteTasks: { type: Boolean, default: false },
    canViewTasks: { type: Boolean, default: true },
    canManageEmployees: { type: Boolean, default: false },
    canCreateProjects: { type: Boolean, default: false },
    canEditProjects: { type: Boolean, default: false },
    canDeleteProjects: { type: Boolean, default: false },
    canViewProjects: { type: Boolean, default: true },
    canManageStructure: { type: Boolean, default: false },
    canViewExecutiveSummary: { type: Boolean, default: false },
    // Legacy compatibility aliases
    canApproveWork: { type: Boolean, default: false },
    canViewTeamTasks: { type: Boolean, default: false },
    canViewAllTasks: { type: Boolean, default: false },
  },
  { _id: false }
);

const accessScopesSchema = new mongoose.Schema(
  {
    taskScope: {
      type: String,
      enum: ["company", "department", "team", "project", "own"],
      default: "own",
    },
    projectScope: {
      type: String,
      enum: ["company", "department", "team", "project", "own"],
      default: "project",
    },
    employeeScope: {
      type: String,
      enum: ["company", "department", "team", "own"],
      default: "own",
    },
    reportScope: {
      type: String,
      enum: ["company", "department", "team", "own"],
      default: "own",
    },
  },
  { _id: false }
);

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
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
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
    team: {
      type: String,
      default: "",
      trim: true,
    },
    teamId: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      default: "employee",
      trim: true,
    },
    positionTitle: {
      type: String,
      default: "",
      trim: true,
    },
    hierarchyLevel: {
      type: Number,
      default: 4,
    },
    permissions: {
      type: permissionsSchema,
      default: () => ({}),
    },
    accessScopes: {
      type: accessScopesSchema,
      default: () => ({}),
    },
    // Multiple managers with relationship types
    reportingRelationships: {
      type: [reportingRelationshipSchema],
      default: [],
    },
    // Kept for backward compatibility, automatically synced with primary/first manager
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

// Pre-save hook to ensure reportsTo is kept in sync with the primary direct manager
userSchema.pre("save", function () {
  if (Array.isArray(this.reportingRelationships) && this.reportingRelationships.length > 0) {
    const directRel = this.reportingRelationships.find((r) => r.relationshipType === "direct");
    this.reportsTo = directRel ? directRel.managerId : this.reportingRelationships[0].managerId;
  } else if (!this.reportsTo) {
    this.reportsTo = null;
  }
});

module.exports = mongoose.model("User", userSchema);
