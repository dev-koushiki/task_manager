const mongoose = require("mongoose");

const helpDeskTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requesterName: {
      type: String,
      default: "",
    },
    requesterEmail: {
      type: String,
      default: "",
    },
    requesterDepartment: {
      type: String,
      default: "",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "Other",
      enum: [
        "Technical Support",
        "IT and Infrastructure",
        "Human Resources",
        "Finance and Accounts",
        "Administration",
        "Project Management",
        "Attendance and Leave",
        "Employee Management",
        "Software and Application Issues",
        "Other",
      ],
      index: true,
    },
    priority: {
      type: String,
      default: "medium",
      enum: ["critical", "high", "medium", "low"],
      index: true,
    },
    status: {
      type: String,
      default: "submitted",
      enum: [
        "submitted",
        "ai-analyzing",
        "awaiting-assignment",
        "assigned",
        "in-progress",
        "waiting-employee-response",
        "escalated",
        "resolved",
        "closed",
        "reopened",
      ],
      index: true,
    },
    // AI Issue Analysis Artifacts
    aiAnalysis: {
      analyzed: { type: Boolean, default: false },
      analyzedAt: { type: Date },
      summary: { type: String, default: "" },
      keywords: [{ type: String }],
      detectedDepartment: { type: String, default: "" },
      suggestedCategory: { type: String, default: "" },
      suggestedPriority: { type: String, default: "" },
      confidenceScore: { type: Number, default: 0 },
      reasoning: { type: String, default: "" },
      suggestedResolution: [{ type: String }], // troubleshooting steps
      aiModelUsed: { type: String, default: "" },
    },
    // Department & Support Assignee
    assignedDepartment: {
      type: String,
      default: "General",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignedAt: {
      type: Date,
    },
    assignedByName: {
      type: String,
      default: "AI Smart Router",
    },
    // Contextual Task or Project
    relatedProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    // Attachments
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        fileType: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // SLA tracking
    sla: {
      responseDeadline: { type: Date },
      resolutionDeadline: { type: Date },
      firstResponseAt: { type: Date },
      isResponseOverdue: { type: Boolean, default: false },
      isResolutionOverdue: { type: Boolean, default: false },
      isEscalated: { type: Boolean, default: false },
      escalatedAt: { type: Date },
      escalationReason: { type: String, default: "" },
    },
    // Resolution details
    resolution: {
      resolvedAt: { type: Date },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      resolvedByName: { type: String, default: "" },
      resolutionSummary: { type: String, default: "" },
      feedbackRating: { type: Number, min: 1, max: 5 },
      feedbackComment: { type: String, default: "" },
    },
    // Activity timeline / audit trail
    timeline: [
      {
        status: { type: String },
        action: { type: String },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        performedByName: { type: String },
        note: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Reopen history
    reopenHistory: [
      {
        reopenedAt: { type: Date, default: Date.now },
        reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reopenedByName: { type: String },
        reason: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Helpful compound indexes for query efficiency
helpDeskTicketSchema.index({ organizationId: 1, status: 1 });
helpDeskTicketSchema.index({ organizationId: 1, assignedDepartment: 1 });
helpDeskTicketSchema.index({ organizationId: 1, requester: 1 });
helpDeskTicketSchema.index({ organizationId: 1, priority: 1 });

module.exports = mongoose.model("HelpDeskTicket", helpDeskTicketSchema);
