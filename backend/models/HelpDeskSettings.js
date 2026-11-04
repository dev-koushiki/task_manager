const mongoose = require("mongoose");

const helpDeskSettingsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      unique: true,
      index: true,
    },
    categories: {
      type: [String],
      default: [
        "Technical Support",
        "IT and Infrastructure",
        "Human Resources",
        "Finance and Accounts",
        "Administration",
        "Project Management",
        "Attendance and Leave",
        "Employee Management",
        "Software and Application Issues",
        "Other",
      ],
    },
    // Configurable SLA hours
    slaHours: {
      critical: {
        responseHours: { type: Number, default: 0.25 }, // 15 mins
        resolutionHours: { type: Number, default: 4 },   // 4 hours
      },
      high: {
        responseHours: { type: Number, default: 1 },    // 1 hour
        resolutionHours: { type: Number, default: 12 },  // 12 hours
      },
      medium: {
        responseHours: { type: Number, default: 4 },    // 4 hours
        resolutionHours: { type: Number, default: 24 },  // 24 hours
      },
      low: {
        responseHours: { type: Number, default: 8 },    // 8 hours
        resolutionHours: { type: Number, default: 48 },  // 48 hours
      },
    },
    // Category -> Department routing mappings
    routingRules: [
      {
        category: { type: String, required: true },
        targetDepartment: { type: String, required: true },
        autoAssignEnabled: { type: Boolean, default: true },
      },
    ],
    // Escalation behavior
    escalationSettings: {
      autoEscalateOverdue: { type: Boolean, default: true },
      escalateToManager: { type: Boolean, default: true },
      escalateToAdmin: { type: Boolean, default: true },
      reopenThresholdForEscalation: { type: Number, default: 2 },
    },
    // AI analysis toggle
    aiSettings: {
      autoCategorization: { type: Boolean, default: true },
      autoDepartmentRouting: { type: Boolean, default: true },
      autoPriorityDetection: { type: Boolean, default: true },
      suggestResolutions: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("HelpDeskSettings", helpDeskSettingsSchema);
