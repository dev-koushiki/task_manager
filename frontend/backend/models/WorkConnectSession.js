const mongoose = require("mongoose");

const workConnectSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "requested",
        "accepted",
        "rejected",
        "cancelled",
        "active",
        "ended",
        "timed_out",
      ],
      default: "requested",
      index: true,
    },
    requestReason: {
      type: String,
      default: "",
      trim: true,
    },
    attachedTask: {
      taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        default: null,
      },
      title: {
        type: String,
        default: "",
      },
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        default: null,
      },
      projectTitle: {
        type: String,
        default: "",
      },
    },
    permissions: {
      allowScreenView: {
        type: Boolean,
        default: true,
      },
      allowVoice: {
        type: Boolean,
        default: true,
      },
      allowVideo: {
        type: Boolean,
        default: true,
      },
      allowAnnotations: {
        type: Boolean,
        default: true,
      },
    },
    screenSharing: {
      isSharing: {
        type: Boolean,
        default: false,
      },
      sharedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      sharingStartedAt: {
        type: Date,
        default: null,
      },
    },
    voiceUsed: {
      type: Boolean,
      default: false,
    },
    videoUsed: {
      type: Boolean,
      default: false,
    },
    annotationsCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    endReason: {
      type: String,
      default: "",
    },
    assistanceSummary: {
      type: String,
      default: "",
      trim: true,
    },
    updatedTaskWithSummary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

workConnectSessionSchema.index({ organizationId: 1, createdAt: -1 });
workConnectSessionSchema.index({ requester: 1, createdAt: -1 });
workConnectSessionSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model("WorkConnectSession", workConnectSessionSchema);
