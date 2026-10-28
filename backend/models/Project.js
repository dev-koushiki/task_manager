const mongoose = require("mongoose");

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
      required: [true, "Project Director is required"],
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
    deadline: {
      type: String,
      required: [true, "Deadline is required"],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["not-started", "on-track", "delayed", "completed"],
      default: "not-started",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
