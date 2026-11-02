const mongoose = require("mongoose");

const periodicEvaluationSnapshotSchema = new mongoose.Schema(
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
    employeeEmail: {
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
      default: "",
      index: true,
    },
    department: {
      type: String,
      default: "General",
    },
    designation: {
      type: String,
      default: "",
    },
    periodType: {
      type: String,
      enum: ["month", "quarter", "half-year", "year"],
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
    },
    periodValue: {
      type: String,
      required: true,
      index: true,
    },
    periodLabel: {
      type: String,
      default: "",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    metrics: {
      taskCompletion: {
        totalAssigned: { type: Number, default: 0 },
        totalCompleted: { type: Number, default: 0 },
        totalSubmitted: { type: Number, default: 0 },
        totalApproved: { type: Number, default: 0 },
        totalRejected: { type: Number, default: 0 },
        totalReopened: { type: Number, default: 0 },
        totalPending: { type: Number, default: 0 },
        totalOverdue: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0 },
        approvalRate: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      },
      submissionSpeed: {
        onTimeCount: { type: Number, default: 0 },
        earlyCount: { type: Number, default: 0 },
        lateCount: { type: Number, default: 0 },
        onTimeRate: { type: Number, default: 0 },
        earlyRate: { type: Number, default: 0 },
        avgTurnaroundHours: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      },
      consistency: {
        weeklyCompletions: {
          type: [
            {
              week: String,
              count: Number,
            },
          ],
          default: () => [],
        },
        activeDaysCount: { type: Number, default: 0 },
        tasksPerDay: { type: Number, default: 0 },
        consistencyScore: { type: Number, default: 0 },
      },
      quality: {
        firstAttemptApprovedCount: { type: Number, default: 0 },
        reworkTotalCount: { type: Number, default: 0 },
        avgAttemptsBeforeApproval: { type: Number, default: 1 },
        qualityScore: { type: Number, default: 0 },
      },
      firstSubmission: {
        comparableFirstSubmissionsCount: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
      },
      workload: {
        totalAssignedWeight: { type: Number, default: 0 },
        completedWeight: { type: Number, default: 0 },
        workloadScore: { type: Number, default: 0 },
      },
    },
    weights: {
      taskCompletionRate: { type: Number, default: 25 },
      onTimeSubmissionRate: { type: Number, default: 20 },
      taskQualityFirstAttempt: { type: Number, default: 25 },
      productivityConsistency: { type: Number, default: 15 },
      comparableFirstSubmission: { type: Number, default: 5 },
      workloadManagement: { type: Number, default: 10 },
    },
    overallScore: {
      type: Number,
      default: 0,
    },
    performanceLevel: {
      type: String,
      enum: ["Outstanding", "Excellent", "Very Good", "Good", "Needs Improvement", "Poor", "Insufficient Data"],
      default: "Insufficient Data",
    },
    hasSufficientData: {
      type: Boolean,
      default: false,
    },
    trend: {
      type: String,
      enum: ["improving", "declining", "stable", "new"],
      default: "new",
    },
    previousScore: {
      type: Number,
      default: null,
    },
    scoreDelta: {
      type: Number,
      default: 0,
    },
    tasksAudited: [
      {
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
        title: String,
        status: String,
        priority: String,
        deadline: String,
        assignedAt: Date,
        submittedAt: Date,
        approvedAt: Date,
        isOnTime: Boolean,
        isFirstAttemptApproved: Boolean,
        isFirstSubmission: Boolean,
        reworkCount: Number,
        reviewDurationHours: Number,
      },
    ],
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

periodicEvaluationSnapshotSchema.index({ organizationId: 1, employeeId: 1, periodType: 1, periodValue: 1 }, { unique: true });
periodicEvaluationSnapshotSchema.index({ companyName: 1, periodType: 1, periodValue: 1, overallScore: -1 });

module.exports = mongoose.model("PeriodicEvaluationSnapshot", periodicEvaluationSnapshotSchema);
