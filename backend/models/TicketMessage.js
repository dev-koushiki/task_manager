const mongoose = require("mongoose");

const ticketMessageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HelpDeskTicket",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: {
      type: String,
      default: "User",
    },
    senderRole: {
      type: String,
      default: "employee",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        fileType: { type: String },
        size: { type: Number },
      },
    ],
    // Internal note visible only to department support staff & admins, hidden from employee
    isInternalNote: {
      type: Boolean,
      default: false,
      index: true,
    },
    // AI assistance tag
    isAiAssisted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

ticketMessageSchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model("TicketMessage", ticketMessageSchema);
