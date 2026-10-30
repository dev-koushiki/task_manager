const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "meeting_invite",
        "meeting_update",
        "meeting_cancel",
        "meeting_reminder",
        "meeting_rsvp",
        "task_assigned",
        "task_converted",
        "general",
      ],
      default: "general",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, organizationId: 1, read: 1 });
notificationSchema.index({ userId: 1, "metadata.taskId": 1, type: 1 });
notificationSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
