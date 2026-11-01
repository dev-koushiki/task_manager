const mongoose = require("mongoose");

const assignedEmployeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "employee" },
    designation: { type: String, default: "" },
    team: { type: String, default: "" },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const progressNoteSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    authorName: {
      type: String,
      default: "",
    },
    authorRole: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const projectMilestoneSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    title: {
      type: String,
      required: [true, "Milestone title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    deadline: {
      type: String,
      default: "",
    },
    dueDate: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["not-started", "in-progress", "submitted", "completed", "delayed"],
      default: "not-started",
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    assignedTo: {
      type: [assignedEmployeeSchema],
      default: () => [],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completedByName: {
      type: String,
      default: "",
    },
    submissionNotes: {
      type: String,
      default: "",
    },
    progressNotes: {
      type: [progressNoteSchema],
      default: () => [],
    },
    phase: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const voiceRecordingSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    title: {
      type: String,
      default: "Voice Note",
    },
    audioUrl: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    recordedByName: {
      type: String,
      default: "",
    },
    associatedMilestoneId: {
      type: String,
      default: null,
    },
    transcript: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "en",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    targetOutcome: {
      type: String,
      trim: true,
      default: "",
    },
    objectives: {
      type: [String],
      default: () => [],
    },
    expectedDeliverables: {
      type: [String],
      default: () => [],
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
      index: true,
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
    directorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    directorName: {
      type: String,
      default: "Unassigned",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: String,
      default: "",
    },
    targetCompletionDate: {
      type: String,
      default: "",
    },
    deadline: {
      type: String,
      default: "",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["not-started", "in-progress", "on-track", "delayed", "completed"],
      default: "not-started",
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    assignedEmployees: {
      type: [assignedEmployeeSchema],
      default: () => [],
    },
    milestones: {
      type: [projectMilestoneSchema],
      default: () => [],
    },
    phases: [
      {
        id: String,
        name: String,
        description: String,
      },
    ],
    recordings: {
      type: [voiceRecordingSchema],
      default: () => [],
    },
    conceptNote: {
      originalFilename: String,
      fileType: String,
      uploadedAt: Date,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rawText: String,
      extractedData: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Indexes for fast querying
projectSchema.index({ organizationId: 1, department: 1 });
projectSchema.index({ organizationId: 1, status: 1 });
projectSchema.index({ organizationId: 1, "assignedEmployees.userId": 1 });
projectSchema.index({ organizationId: 1, directorId: 1 });

module.exports = mongoose.model("Project", projectSchema);
