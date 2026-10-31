const mongoose = require("mongoose");

const taskReviewSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewerName: {
      type: String,
      default: "",
    },
    decision: {
      type: String,
      enum: ["approved", "changes_requested", "comment", "reply"],
      required: true,
      default: "comment",
    },
    feedback: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

taskReviewSchema.index({ taskId: 1, createdAt: -1 });
taskReviewSchema.index({ reviewerId: 1 });

module.exports = mongoose.model("TaskReview", taskReviewSchema);
