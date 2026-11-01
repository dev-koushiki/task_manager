const mongoose = require("mongoose");

const scoreBreakdownSchema = new mongoose.Schema(
  {
    qualityOfWork: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    timeliness: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    initiative: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    collaboration: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    overallScore: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
  },
  { _id: false }
);

const disputeSchema = new mongoose.Schema(
  {
    isDisputed: {
      type: Boolean,
      default: false,
    },
    disputedAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    employeeNotes: {
      type: String,
      default: "",
      trim: true,
    },
    resolutionStatus: {
      type: String,
      enum: ["none", "pending", "reviewed", "adjusted", "upheld"],
      default: "none",
    },
    resolutionNotes: {
      type: String,
      default: "",
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedByName: {
      type: String,
      default: "",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const auditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true, // "created", "updated", "disputed", "resolved"
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedByName: {
      type: String,
      default: "",
    },
    performedByRole: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      default: "",
    },
    previousScores: {
      type: Object,
      default: null,
    },
  },
  { _id: false }
);

const performanceRatingSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      default: "",
    },
    employeeDesignation: {
      type: String,
      default: "",
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    evaluatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    evaluatorName: {
      type: String,
      default: "",
    },
    evaluatorRole: {
      type: String,
      default: "",
    },
    evaluatorHierarchyLevel: {
      type: Number,
      default: 3,
    },
    evaluatorTier: {
      type: String,
      enum: ["L1", "L2", "L3", "Self"],
      default: "L3",
    },
    evaluationType: {
      type: String,
      enum: ["superior", "self"],
      default: "superior",
      index: true,
    },
    period: {
      type: String,
      default: () => {
        const d = new Date();
        const quarter = Math.floor(d.getMonth() / 3) + 1;
        return `Q${quarter} ${d.getFullYear()}`;
      },
    },
    scores: {
      type: scoreBreakdownSchema,
      required: true,
    },
    strengths: {
      type: [String],
      default: [],
    },
    areasForImprovement: {
      type: [String],
      default: [],
    },
    comments: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "disputed", "resolved"],
      default: "published",
    },
    dispute: {
      type: disputeSchema,
      default: () => ({}),
    },
    auditTrail: {
      type: [auditEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

performanceRatingSchema.index({ employeeId: 1, evaluationType: 1, createdAt: -1 });

module.exports = mongoose.model("PerformanceRating", performanceRatingSchema);
