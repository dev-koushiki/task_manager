const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "tentative"],
      default: "pending",
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const actionItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assigneeName: {
      type: String,
      default: "",
      trim: true,
    },
    dueDate: {
      type: String,
      default: "",
      trim: true,
    },
    convertedToTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "converted"],
      default: "pending",
    },
  },
  { _id: true }
);

const minutesSchema = new mongoose.Schema(
  {
    notes: {
      type: String,
      default: "",
    },
    decisions: {
      type: [String],
      default: [],
    },
    actionItems: {
      type: [actionItemSchema],
      default: [],
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recordedByName: {
      type: String,
      default: "",
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
  },
  { _id: true }
);

const chatMessageSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Meeting title is required"],
      trim: true,
    },
    agenda: {
      type: String,
      default: "",
      trim: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: [true, "Meeting date is required"],
      trim: true,
    },
    startTime: {
      type: String, // HH:mm format, e.g. "10:00"
      required: [true, "Start time is required"],
      trim: true,
    },
    endTime: {
      type: String, // HH:mm format, e.g. "11:00"
      required: [true, "End time is required"],
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    meetingLink: {
      type: String,
      default: "",
      trim: true,
    },
    mode: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
    },
    roomCode: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    roomId: {
      type: String,
      trim: true,
      default: "",
    },
    googleEventId: {
      type: String,
      default: "",
    },
    googleMeetLink: {
      type: String,
      default: "",
    },
    googleSynced: {
      type: Boolean,
      default: false,
    },
    attendance: {
      type: [attendanceSchema],
      default: [],
    },
    chatMessages: {
      type: [chatMessageSchema],
      default: [],
    },
    hostControls: {
      muteAll: { type: Boolean, default: false },
      lockMeeting: { type: Boolean, default: false },
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    projectName: {
      type: String,
      default: "",
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizerName: {
      type: String,
      required: true,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },
    minutes: {
      type: minutesSchema,
      default: () => ({ notes: "", decisions: [], actionItems: [] }),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);
