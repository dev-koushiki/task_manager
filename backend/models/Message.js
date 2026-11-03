const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    senderName: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    messageType: {
      type: String,
      enum: ["text", "voice", "file", "image"],
      default: "text",
    },
    fileUrl: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    fileType: {
      type: String,
      default: "",
    },
    audioDuration: {
      type: Number,
      default: 0,
    },
    replyTo: {
      type: replySchema,
      default: null,
    },
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

messageSchema.index({ groupId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
