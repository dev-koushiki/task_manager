const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: "employee",
      required: true,
    },
    positionTitle: {
      type: String,
      default: "Specialist / Employee",
      trim: true,
    },
    hierarchyLevel: {
      type: Number,
      default: 4,
    },
    permissions: {
      type: Object,
      default: {},
    },
    companyName: {
      type: String,
      default: "Workspace",
    },
    tokenHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invitation", invitationSchema);
