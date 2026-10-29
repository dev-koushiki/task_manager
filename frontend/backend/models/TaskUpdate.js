const mongoose = require("mongoose");

const taskUpdateSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedByName: {
      type: String,
      default: "",
    },
    oldStatus: {
      type: String,
      default: "",
    },
    newStatus: {
      type: String,
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
    blocker: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskUpdate", taskUpdateSchema);
