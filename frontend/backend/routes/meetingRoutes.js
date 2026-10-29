const express = require("express");
const router = express.Router();
const Meeting = require("../models/Meeting");
const Task = require("../models/Task");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");

// Helper function to check scheduling conflicts
async function findSchedulingConflicts({ organizationId, date, startTime, endTime, participantIds = [], excludeMeetingId = null }) {
  if (!date || !startTime || !endTime || !participantIds || participantIds.length === 0) {
    return [];
  }

  const query = {
    organizationId,
    date,
    status: "scheduled",
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeMeetingId) {
    query._id = { $ne: excludeMeetingId };
  }

  const overlappingMeetings = await Meeting.find(query);
  const conflicts = [];
  const pIdStrings = participantIds.map((id) => id.toString());

  for (const m of overlappingMeetings) {
    // Check organizer
    if (pIdStrings.includes(m.organizer.toString())) {
      conflicts.push({
        userId: m.organizer.toString(),
        name: m.organizerName,
        meetingId: m._id,
        meetingTitle: m.title,
        startTime: m.startTime,
        endTime: m.endTime,
      });
    }

    // Check participants
    for (const part of m.participants) {
      if (part.userId && pIdStrings.includes(part.userId.toString()) && part.status !== "declined") {
        conflicts.push({
          userId: part.userId.toString(),
          name: part.name,
          meetingId: m._id,
          meetingTitle: m.title,
          startTime: m.startTime,
          endTime: m.endTime,
        });
      }
    }
  }

  // De-duplicate conflicts
  const unique = [];
  const seen = new Set();
  for (const c of conflicts) {
    const key = `${c.userId}-${c.meetingId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
}

// GET /api/meetings/conflicts - Check availability and conflict warnings
router.get("/conflicts", authMiddleware, async (req, res) => {
  try {
    const { date, startTime, endTime, participantIds, excludeMeetingId } = req.query;
    const ids = participantIds ? (Array.isArray(participantIds) ? participantIds : participantIds.split(",")) : [];

    const conflicts = await findSchedulingConflicts({
      organizationId: req.user.organizationId,
      date,
      startTime,
      endTime,
      participantIds: ids,
      excludeMeetingId,
    });

    res.json({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/meetings - List meetings for the workspace
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { date, month, projectId, status } = req.query;
    const filter = { organizationId: req.user.organizationId };

    if (date) filter.date = date;
    if (month) filter.date = { $regex: `^${month}` }; // Matches YYYY-MM
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;

    const meetings = await Meeting.find(filter).sort({ date: 1, startTime: 1 });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/meetings - Schedule a new meeting
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      agenda,
      date,
      startTime,
      endTime,
      location,
      meetingLink,
      projectId,
      participants = [],
    } = req.body;

    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ message: "Title, date, start time, and end time are required." });
    }

    let projectName = "";
    if (projectId) {
      const proj = await Project.findById(projectId);
      if (proj) projectName = proj.title || proj.name || "";
    }

    const participantIds = participants.map((p) => p.userId).filter(Boolean);
    participantIds.push(req.user._id);

    // Check conflicts
    const conflicts = await findSchedulingConflicts({
      organizationId: req.user.organizationId,
      date,
      startTime,
      endTime,
      participantIds,
    });

    const organizerName = `${req.user.firstName} ${req.user.lastName}`.trim();

    // Map participants ensuring organizer or user is handled
    const mappedParticipants = participants.map((p) => ({
      userId: p.userId,
      name: p.name,
      email: p.email,
      status: p.userId.toString() === req.user.id.toString() ? "accepted" : (p.status || "pending"),
      respondedAt: p.userId.toString() === req.user.id.toString() ? new Date() : null,
    }));

    const meeting = await Meeting.create({
      title: title.trim(),
      agenda: agenda || "",
      date,
      startTime,
      endTime,
      location: location || "",
      meetingLink: meetingLink || "",
      organizationId: req.user.organizationId,
      projectId: projectId || null,
      projectName,
      organizer: req.user._id,
      organizerName,
      participants: mappedParticipants,
      status: "scheduled",
    });

    // Send notifications to participants (except organizer)
    const notifications = mappedParticipants
      .filter((p) => p.userId.toString() !== req.user.id.toString())
      .map((p) => ({
        userId: p.userId,
        organizationId: req.user.organizationId,
        type: "meeting_invite",
        title: "New Meeting Invitation",
        message: `${organizerName} invited you to "${meeting.title}" on ${meeting.date} at ${meeting.startTime}.`,
        link: `/calendar?meetingId=${meeting._id}`,
        metadata: {
          meetingId: meeting._id,
          date: meeting.date,
          startTime: meeting.startTime,
          location: meeting.location || meeting.meetingLink,
        },
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications).catch((e) => console.warn("Notification error:", e.message));
    }

    res.status(201).json({
      message: "Meeting scheduled successfully.",
      meeting,
      conflicts,
      hasConflict: conflicts.length > 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/meetings/:id - Get a single meeting
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/meetings/:id - Update meeting details
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const {
      title,
      agenda,
      date,
      startTime,
      endTime,
      location,
      meetingLink,
      projectId,
      participants,
    } = req.body;

    if (title) meeting.title = title.trim();
    if (agenda !== undefined) meeting.agenda = agenda;
    if (date) meeting.date = date;
    if (startTime) meeting.startTime = startTime;
    if (endTime) meeting.endTime = endTime;
    if (location !== undefined) meeting.location = location;
    if (meetingLink !== undefined) meeting.meetingLink = meetingLink;

    if (projectId !== undefined) {
      meeting.projectId = projectId || null;
      if (projectId) {
        const proj = await Project.findById(projectId);
        meeting.projectName = proj ? (proj.title || proj.name) : "";
      } else {
        meeting.projectName = "";
      }
    }

    if (Array.isArray(participants)) {
      // Merge participant list preserving existing RSVP status
      const existingMap = new Map();
      meeting.participants.forEach((p) => {
        existingMap.set(p.userId.toString(), { status: p.status, respondedAt: p.respondedAt });
      });

      meeting.participants = participants.map((p) => {
        const existing = existingMap.get(p.userId ? p.userId.toString() : "");
        return {
          userId: p.userId,
          name: p.name,
          email: p.email,
          status: existing ? existing.status : "pending",
          respondedAt: existing ? existing.respondedAt : null,
        };
      });
    }

    // Check conflicts
    const pIds = meeting.participants.map((p) => p.userId).filter(Boolean);
    pIds.push(meeting.organizer);

    const conflicts = await findSchedulingConflicts({
      organizationId: req.user.organizationId,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      participantIds: pIds,
      excludeMeetingId: meeting._id,
    });

    await meeting.save();

    // Send update notification
    const notifications = meeting.participants
      .filter((p) => p.userId.toString() !== req.user.id.toString())
      .map((p) => ({
        userId: p.userId,
        organizationId: req.user.organizationId,
        type: "meeting_update",
        title: "Meeting Details Updated",
        message: `"${meeting.title}" was updated: scheduled for ${meeting.date} at ${meeting.startTime}.`,
        link: `/calendar?meetingId=${meeting._id}`,
        metadata: { meetingId: meeting._id },
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications).catch((e) => console.warn("Notification error:", e.message));
    }

    res.json({
      message: "Meeting updated successfully.",
      meeting,
      conflicts,
      hasConflict: conflicts.length > 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/meetings/:id/cancel - Cancel meeting
router.post("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const { reason = "" } = req.body;
    meeting.status = "cancelled";
    meeting.cancellationReason = reason.trim();
    await meeting.save();

    // Notify participants
    const notifications = meeting.participants
      .filter((p) => p.userId.toString() !== req.user.id.toString())
      .map((p) => ({
        userId: p.userId,
        organizationId: req.user.organizationId,
        type: "meeting_cancel",
        title: "Meeting Cancelled",
        message: `"${meeting.title}" on ${meeting.date} has been cancelled.${reason ? ` Reason: ${reason}` : ""}`,
        link: `/calendar`,
        metadata: { meetingId: meeting._id },
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications).catch((e) => console.warn("Notification error:", e.message));
    }

    res.json({ message: "Meeting cancelled successfully.", meeting });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/meetings/:id/respond - RSVP to meeting invitation (accept, decline, tentative)
router.post("/:id/respond", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "declined", "tentative"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'accepted', 'declined', or 'tentative'." });
    }

    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const participant = meeting.participants.find(
      (p) => p.userId && p.userId.toString() === req.user.id.toString()
    );

    if (!participant) {
      return res.status(403).json({ message: "You are not listed as a participant for this meeting." });
    }

    participant.status = status;
    participant.respondedAt = new Date();
    await meeting.save();

    // Notify organizer if respondent is not organizer
    if (meeting.organizer.toString() !== req.user.id.toString()) {
      await Notification.create({
        userId: meeting.organizer,
        organizationId: req.user.organizationId,
        type: "meeting_rsvp",
        title: "Meeting Invitation Response",
        message: `${req.user.firstName} ${req.user.lastName} has marked '${status}' for "${meeting.title}".`,
        link: `/calendar?meetingId=${meeting._id}`,
        metadata: { meetingId: meeting._id, participantId: req.user.id, status },
      }).catch((e) => console.warn("Notification error:", e.message));
    }

    res.json({ message: `Invitation response recorded as ${status}.`, meeting });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/meetings/:id/minutes - Record meeting minutes (notes, decisions, action items)
router.post("/:id/minutes", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const { notes = "", decisions = [], actionItems = [] } = req.body;

    meeting.minutes = {
      notes,
      decisions: Array.isArray(decisions) ? decisions : [],
      actionItems: Array.isArray(actionItems)
        ? actionItems.map((ai) => ({
            description: ai.description,
            assigneeId: ai.assigneeId || null,
            assigneeName: ai.assigneeName || "",
            dueDate: ai.dueDate || meeting.date,
            convertedToTaskId: ai.convertedToTaskId || null,
            status: ai.status || "pending",
          }))
        : [],
      recordedBy: req.user._id,
      recordedByName: `${req.user.firstName} ${req.user.lastName}`.trim(),
      recordedAt: new Date(),
    };

    meeting.status = "completed";
    await meeting.save();

    res.json({ message: "Meeting minutes recorded successfully.", meeting });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/meetings/:id/action-items/:actionItemId/convert - Convert an action item to a system Task
router.post("/:id/action-items/:actionItemId/convert", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const actionItems = meeting.minutes?.actionItems || [];
    const actionItem = actionItems.find((ai) => ai._id && ai._id.toString() === req.params.actionItemId.toString()) ||
      (typeof actionItems.id === "function" ? actionItems.id(req.params.actionItemId) : null);

    if (!actionItem) {
      return res.status(404).json({ message: "Action item not found in meeting minutes." });
    }

    if (actionItem.status === "converted" && actionItem.convertedToTaskId) {
      return res.status(400).json({ message: "This action item has already been converted into a task." });
    }

    // Create the task in the Task collection
    const newTask = await Task.create({
      title: actionItem.description,
      description: `Follow-up action item from meeting: "${meeting.title}" (Date: ${meeting.date})`,
      organizationId: meeting.organizationId,
      projectId: meeting.projectId || null,
      assignedTo: actionItem.assigneeId || req.user._id,
      assignedToName: actionItem.assigneeName || `${req.user.firstName} ${req.user.lastName}`,
      assignedBy: req.user._id,
      assignedByName: `${req.user.firstName} ${req.user.lastName}`,
      deadline: actionItem.dueDate || meeting.date,
      dueDate: actionItem.dueDate || meeting.date,
      status: "not-started",
      priority: "medium",
      progress: 0,
      user: req.user._id,
    });

    // Update the action item
    actionItem.status = "converted";
    actionItem.convertedToTaskId = newTask._id;
    await meeting.save();

    // Notify assignee if assigned
    if (actionItem.assigneeId && actionItem.assigneeId.toString() !== req.user.id.toString()) {
      await Notification.create({
        userId: actionItem.assigneeId,
        organizationId: req.user.organizationId,
        type: "task_assigned",
        title: "New Follow-up Task Assigned",
        message: `Task "${newTask.title}" was generated from meeting "${meeting.title}" and assigned to you.`,
        link: `/tasks?taskId=${newTask._id}`,
        metadata: { taskId: newTask._id, meetingId: meeting._id },
      }).catch((e) => console.warn("Notification error:", e.message));
    }

    res.status(201).json({
      message: "Action item converted into task successfully.",
      task: newTask,
      meeting,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
