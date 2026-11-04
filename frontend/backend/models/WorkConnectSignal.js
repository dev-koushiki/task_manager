const mongoose = require("mongoose");

const workConnectSignalSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      default: "",
    },
    targetUserId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "offer",
        "answer",
        "candidate",
        "permission_update",
        "screen_status",
        "annotation",
        "chat",
        "terminate",
      ],
    },
    signal: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // Automatically pruned after 10 minutes (TTL index)
    },
  },
  {
    timestamps: true,
  }
);

workConnectSignalSchema.index({ sessionId: 1, targetUserId: 1, createdAt: 1 });

module.exports = mongoose.model("WorkConnectSignal", workConnectSignalSchema);
