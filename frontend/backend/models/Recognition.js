const mongoose = require("mongoose");

const recognitionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    employeeIdNumber: {
      type: String,
      default: "",
      trim: true,
    },
    employeePhoto: {
      type: String,
      default: "",
    },
    employeeDesignation: {
      type: String,
      default: "",
    },
    department: {
      type: String,
      default: "General",
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["month", "year", "custom"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    period: {
      type: String,
      required: true,
      trim: true,
    },
    criteriaScores: {
      ratingScore: { type: Number, default: 0 },
      qualityScore: { type: Number, default: 0 },
      deliveryScore: { type: Number, default: 0 },
      initiativeScore: { type: Number, default: 0 },
      compositeScore: { type: Number, default: 0 },
    },
    customComment: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["nominated", "approved", "published"],
      default: "approved",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedByName: {
      type: String,
      default: "",
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
    certificatePdfUrl: {
      type: String,
      default: "",
    },
    certificatePngUrl: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

recognitionSchema.index({ companyName: 1, type: 1, period: 1 });
recognitionSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model("Recognition", recognitionSchema);
