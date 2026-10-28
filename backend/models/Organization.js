const mongoose = require("mongoose");

const defaultLevels = [
  { level: 1, name: "Executive / Leadership", description: "Strategic oversight and organization-wide KPIs" },
  { level: 2, name: "Department Heads / Directors", description: "Project milestone planning and departmental governance" },
  { level: 3, name: "Managers & Team Leads", description: "Task delegation, blocker resolution, and quality approval" },
  { level: 4, name: "Specialists & Contributors", description: "Operational task execution and deliverable submissions" },
];

const defaultPositions = [
  {
    id: "pos_1",
    title: "Chief Executive / Head of Office",
    level: 1,
    department: "Executive Leadership",
    permissions: {
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
      // Legacy compatibility
      canApproveWork: true,
      canViewTeamTasks: true,
      canViewAllTasks: true,
    },
    accessScopes: {
      taskScope: "company",
      projectScope: "company",
      employeeScope: "company",
      reportScope: "company",
    },
  },
  {
    id: "pos_2",
    title: "Project Director",
    level: 2,
    department: "Project Management Office",
    permissions: {
      canCreateTasks: true,
      canAssignTasks: true,
      canEditTasks: true,
      canApproveTasks: true,
      canDeleteTasks: false,
      canViewTasks: true,
      canManageEmployees: false,
      canCreateProjects: true,
      canEditProjects: true,
      canDeleteProjects: false,
      canViewProjects: true,
      canManageStructure: false,
      canViewExecutiveSummary: true,
      // Legacy compatibility
      canApproveWork: true,
      canViewTeamTasks: true,
      canViewAllTasks: false,
    },
    accessScopes: {
      taskScope: "project",
      projectScope: "project",
      employeeScope: "department",
      reportScope: "department",
    },
  },
  {
    id: "pos_3",
    title: "Team Leader / Manager",
    level: 3,
    department: "Engineering & Technology",
    permissions: {
      canCreateTasks: true,
      canAssignTasks: true,
      canEditTasks: true,
      canApproveTasks: true,
      canDeleteTasks: false,
      canViewTasks: true,
      canManageEmployees: false,
      canCreateProjects: false,
      canEditProjects: false,
      canDeleteProjects: false,
      canViewProjects: true,
      canManageStructure: false,
      canViewExecutiveSummary: false,
      // Legacy compatibility
      canApproveWork: true,
      canViewTeamTasks: true,
      canViewAllTasks: false,
    },
    accessScopes: {
      taskScope: "team",
      projectScope: "project",
      employeeScope: "team",
      reportScope: "team",
    },
  },
  {
    id: "pos_4",
    title: "Specialist / Employee",
    level: 4,
    department: "Engineering & Technology",
    permissions: {
      canCreateTasks: false,
      canAssignTasks: false,
      canEditTasks: false,
      canApproveTasks: false,
      canDeleteTasks: false,
      canViewTasks: true,
      canManageEmployees: false,
      canCreateProjects: false,
      canEditProjects: false,
      canDeleteProjects: false,
      canViewProjects: true,
      canManageStructure: false,
      canViewExecutiveSummary: false,
      // Legacy compatibility
      canApproveWork: false,
      canViewTeamTasks: false,
      canViewAllTasks: false,
    },
    accessScopes: {
      taskScope: "own",
      projectScope: "project",
      employeeScope: "own",
      reportScope: "own",
    },
  },
];

const defaultDepartments = [
  "Executive Leadership",
  "Project Management Office",
  "Engineering & Technology",
  "Product & Design",
  "Operations & Quality",
  "Human Resources & Finance",
  "Marketing & Sales",
];

const defaultTeams = [
  {
    id: "team_1",
    name: "Core Platform Squad",
    department: "Engineering & Technology",
    description: "Backend architecture, APIs, and infrastructure maintenance",
    leadName: "Platform Lead",
    memberIds: [],
  },
  {
    id: "team_2",
    name: "Product Design Squad",
    department: "Product & Design",
    description: "Design systems, prototyping, and user journeys",
    leadName: "UI/UX Lead",
    memberIds: [],
  },
];

const defaultRelationshipTypes = [
  {
    id: "direct",
    name: "Direct Manager",
    description: "Line manager responsible for core evaluations, performance, and general oversight",
  },
  {
    id: "project",
    name: "Project Manager",
    description: "Manager coordinating specific projects, deliverables, milestones, and task review",
  },
  {
    id: "functional",
    name: "Functional Manager",
    description: "Discipline or chapter lead guiding technical standards, quality, and mentorship",
  },
];

const permissionSchema = new mongoose.Schema(
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

const scopeSchema = new mongoose.Schema(
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

const positionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  level: { type: Number, required: true, default: 4 },
  department: { type: String, default: "General", trim: true },
  permissions: {
    type: permissionSchema,
    default: () => ({}),
  },
  accessScopes: {
    type: scopeSchema,
    default: () => ({}),
  },
});

const hierarchyLevelSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
});

const teamSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  department: { type: String, default: "General", trim: true },
  description: { type: String, default: "", trim: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  leadName: { type: String, default: "" },
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const relationshipTypeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
});

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    departments: {
      type: [String],
      default: defaultDepartments,
    },
    teams: {
      type: [teamSchema],
      default: defaultTeams,
    },
    levels: {
      type: [hierarchyLevelSchema],
      default: defaultLevels,
    },
    positions: {
      type: [positionSchema],
      default: defaultPositions,
    },
    relationshipTypes: {
      type: [relationshipTypeSchema],
      default: defaultRelationshipTypes,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
