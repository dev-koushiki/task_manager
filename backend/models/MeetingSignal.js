const mongoose = require("mongoose");

const meetingSignalSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      index: true,
    },
    targetUserId: {
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
    type: {
      type: String,
      default: "",
    },
    signal: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60, // TTL index: auto-purged after 60 seconds
    },
  },
  { timestamps: false }
);

meetingSignalSchema.index({ roomCode: 1, targetUserId: 1 });

module.exports = mongoose.model("MeetingSignal", meetingSignalSchema);
