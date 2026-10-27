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
      canCreateProjects: true,
      canAssignTasks: true,
      canApproveWork: true,
      canViewExecutiveSummary: true,
      canViewTeamTasks: true,
      canViewAllTasks: true,
      canManageStructure: true,
    },
  },
  {
    id: "pos_2",
    title: "Project Director",
    level: 2,
    department: "Project Management Office",
    permissions: {
      canCreateProjects: true,
      canAssignTasks: true,
      canApproveWork: true,
      canViewExecutiveSummary: true,
      canViewTeamTasks: true,
      canViewAllTasks: false,
      canManageStructure: false,
    },
  },
  {
    id: "pos_3",
    title: "Team Leader / Manager",
    level: 3,
    department: "Engineering & Technology",
    permissions: {
      canCreateProjects: false,
      canAssignTasks: true,
      canApproveWork: true,
      canViewExecutiveSummary: false,
      canViewTeamTasks: true,
      canViewAllTasks: false,
      canManageStructure: false,
    },
  },
  {
    id: "pos_4",
    title: "Specialist / Employee",
    level: 4,
    department: "Engineering & Technology",
    permissions: {
      canCreateProjects: false,
      canAssignTasks: false,
      canApproveWork: false,
      canViewExecutiveSummary: false,
      canViewTeamTasks: false,
      canViewAllTasks: false,
      canManageStructure: false,
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
];

const positionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  level: { type: Number, required: true, default: 4 },
  department: { type: String, default: "General", trim: true },
  permissions: {
    canCreateProjects: { type: Boolean, default: false },
    canAssignTasks: { type: Boolean, default: false },
    canApproveWork: { type: Boolean, default: false },
    canViewExecutiveSummary: { type: Boolean, default: false },
    canViewTeamTasks: { type: Boolean, default: false },
    canViewAllTasks: { type: Boolean, default: false },
    canManageStructure: { type: Boolean, default: false },
  },
});

const hierarchyLevelSchema = new mongoose.Schema({
  level: { type: Number, required: true },
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
    levels: {
      type: [hierarchyLevelSchema],
      default: defaultLevels,
    },
    positions: {
      type: [positionSchema],
      default: defaultPositions,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
