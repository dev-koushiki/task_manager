const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedByName: { type: String, default: "" },
  },
  { _id: true }
);

const reviewCommentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      default: "",
    },
    authorRole: {
      type: String,
      default: "",
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    decision: {
      type: String,
      enum: ["approved", "changes_requested", "comment", "reply"],
      default: "comment",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
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
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
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
    weight: {
      type: Number,
      min: 1,
      default: 1,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    deadline: {
      type: String,
      default: "",
    },
    dueDate: {
      type: String,
      default: "",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assignedToName: {
      type: String,
      default: "Unassigned",
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedByName: {
      type: String,
      default: "Supervisor",
    },
    blocker: {
      type: String,
      trim: true,
      default: "",
    },
    submissionNotes: {
      type: String,
      trim: true,
      default: "",
    },
    reviewFeedback: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    milestones: {
      type: [milestoneSchema],
      default: () => [],
    },
    reviewComments: {
      type: [reviewCommentSchema],
      default: () => [],
    },
  },
  { timestamps: true }
);

// Performance compound indexes for lightning-fast queries
taskSchema.index({ organizationId: 1, status: 1 });
taskSchema.index({ organizationId: 1, assignedTo: 1 });
taskSchema.index({ organizationId: 1, assignedBy: 1 });
taskSchema.index({ organizationId: 1, parentTaskId: 1 });
taskSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model("Task", taskSchema);
