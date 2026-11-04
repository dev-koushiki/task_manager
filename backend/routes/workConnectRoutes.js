const express = require("express");
const router = express.Router();
const WorkConnectSession = require("../models/WorkConnectSession");
const WorkConnectSignal = require("../models/WorkConnectSignal");
const User = require("../models/User");
const Task = require("../models/Task");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");

// In-memory active presence tracker and socket relay reference
const activePresence = new Map(); // userId -> { status, lastPing, socketId, sessionId }
let ioInstance = null;

const setWorkConnectIO = (io) => {
  ioInstance = io;
};

// Middleware: WorkConnect permission check
const workConnectAuth = (req, res, next) => {
  if (req.user && req.user.permissions && req.user.permissions.canUseWorkConnect === false) {
    return res.status(403).json({ message: "WorkConnect access is disabled for your account." });
  }
  next();
};

// ----------------------------------------------------
// 1. GET /api/workconnect/employees - Search & list colleagues
// ----------------------------------------------------
router.get("/employees", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const currentUserId = req.user.id.toString();
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const queryFilter = {
      _id: { $ne: currentUser._id },
      status: { $ne: "disabled" },
    };

    if (currentUser.organizationId) {
      queryFilter.organizationId = currentUser.organizationId;
    } else if (currentUser.companyName) {
      queryFilter.companyName = currentUser.companyName;
    }

    const { q, department, status } = req.query;

    if (department && department !== "all") {
      queryFilter.department = department;
    }

    const colleagues = await User.find(queryFilter)
      .select("firstName lastName email designation department employeeId role profilePhoto workConnectStatus workConnectLastSeen currentWorkConnectSessionId reportsTo")
      .populate("reportsTo", "firstName lastName designation")
      .lean();

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    let mapped = colleagues.map((colleague) => {
      const cId = colleague._id.toString();
      const inMem = activePresence.get(cId);

      let effectiveStatus = "offline";
      if (inMem && (Date.now() - inMem.lastPing < 2 * 60 * 1000)) {
        effectiveStatus = inMem.status || "online";
      } else if (colleague.workConnectStatus && colleague.workConnectLastSeen && new Date(colleague.workConnectLastSeen) > twoMinutesAgo) {
        effectiveStatus = colleague.workConnectStatus;
      }

      // Check hierarchy relationship
      const isMyManager = currentUser.reportsTo && currentUser.reportsTo.toString() === cId;
      const isMySubordinate = colleague.reportsTo && colleague.reportsTo._id && colleague.reportsTo._id.toString() === currentUserId;

      return {
        _id: cId,
        id: cId,
        firstName: colleague.firstName,
        lastName: colleague.lastName,
        name: `${colleague.firstName} ${colleague.lastName}`.trim(),
        email: colleague.email,
        designation: colleague.designation || "Staff",
        department: colleague.department || "General",
        employeeId: colleague.employeeId || "",
        role: colleague.role || "employee",
        profilePhoto: colleague.profilePhoto || "",
        status: effectiveStatus,
        isMyManager: Boolean(isMyManager),
        isMySubordinate: Boolean(isMySubordinate),
        currentSessionId: colleague.currentWorkConnectSessionId || "",
      };
    });

    // Client search filter
    if (q && q.trim()) {
      const searchStr = q.toLowerCase().trim();
      mapped = mapped.filter((emp) =>
        emp.name.toLowerCase().includes(searchStr) ||
        emp.email.toLowerCase().includes(searchStr) ||
        emp.department.toLowerCase().includes(searchStr) ||
        emp.designation.toLowerCase().includes(searchStr) ||
        emp.employeeId.toLowerCase().includes(searchStr)
      );
    }

    if (status && status !== "all") {
      mapped = mapped.filter((emp) => emp.status === status);
    }

    res.json({ employees: mapped, total: mapped.length });
  } catch (err) {
    console.error("WorkConnect employees query error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 2. POST /api/workconnect/status - Update availability & Heartbeat
// ----------------------------------------------------
router.post("/status", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const { status, sessionId } = req.body;
    const validStatuses = ["online", "offline", "busy", "in-session", "dnd"];
    const newStatus = validStatuses.includes(status) ? status : "online";

    activePresence.set(userId, {
      status: newStatus,
      lastPing: Date.now(),
      sessionId: sessionId || "",
    });

    await User.findByIdAndUpdate(userId, {
      workConnectStatus: newStatus,
      workConnectLastSeen: new Date(),
      currentWorkConnectSessionId: sessionId || "",
    });

    if (ioInstance) {
      ioInstance.emit("workconnect_status_update", {
        userId,
        status: newStatus,
        lastSeen: new Date(),
      });
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 3. POST /api/workconnect/request - Request Connection
// ----------------------------------------------------
router.post("/request", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const requesterId = req.user.id.toString();
    const { targetUserId, reason, taskId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "targetUserId is required." });
    }

    if (targetUserId === requesterId) {
      return res.status(400).json({ message: "Cannot initiate connection with yourself." });
    }

    const [requester, targetUser] = await Promise.all([
      User.findById(requesterId),
      User.findById(targetUserId),
    ]);

    if (!targetUser || targetUser.status === "disabled") {
      return res.status(404).json({ message: "Target employee not found or account disabled." });
    }

    // Attach task if specified
    let attachedTaskData = null;
    if (taskId) {
      const taskObj = await Task.findById(taskId).populate("projectId", "name");
      if (taskObj) {
        attachedTaskData = {
          taskId: taskObj._id,
          title: taskObj.title,
          projectId: taskObj.projectId?._id || null,
          projectTitle: taskObj.projectId?.name || "General Workspace",
        };
      }
    }

    const sessionId = `wc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const newSession = await WorkConnectSession.create({
      sessionId,
      requester: requester._id,
      receiver: targetUser._id,
      organizationId: requester.organizationId || targetUser.organizationId || null,
      status: "requested",
      requestReason: reason || (attachedTaskData ? `Assistance with task: ${attachedTaskData.title}` : "Remote collaboration & assistance session"),
      attachedTask: attachedTaskData || undefined,
      permissions: {
        allowScreenView: true,
        allowVoice: true,
        allowVideo: true,
        allowAnnotations: true,
      },
    });

    // Create persistent system Notification for the receiver
    await Notification.create({
      userId: targetUser._id,
      title: "WorkConnect Assistance Request",
      message: `${requester.firstName} ${requester.lastName} is requesting a remote collaboration session${attachedTaskData ? ` for "${attachedTaskData.title}"` : ""}.`,
      type: "meeting",
      link: `/?tab=workconnect&sub=incoming&session=${sessionId}`,
      metadata: {
        sessionId,
        requesterId,
        requesterName: `${requester.firstName} ${requester.lastName}`,
        taskId: attachedTaskData?.taskId || null,
      },
    }).catch(() => {});

    // Realtime Socket broadcast
    if (ioInstance) {
      ioInstance.to(targetUserId).emit("workconnect_incoming_request", {
        sessionId,
        requester: {
          id: requester._id,
          name: `${requester.firstName} ${requester.lastName}`,
          designation: requester.designation,
          department: requester.department,
          profilePhoto: requester.profilePhoto,
        },
        reason: newSession.requestReason,
        attachedTask: newSession.attachedTask,
        createdAt: newSession.createdAt,
      });
    }

    res.status(201).json({
      success: true,
      message: "Connection request sent successfully.",
      session: newSession,
      sessionId,
    });
  } catch (err) {
    console.error("WorkConnect request creation error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 4. GET /api/workconnect/requests/incoming - Incoming requests
// ----------------------------------------------------
router.get("/requests/incoming", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const requests = await WorkConnectSession.find({
      receiver: userId,
      status: "requested",
    })
      .populate("requester", "firstName lastName email designation department employeeId profilePhoto")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ requests, count: requests.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 5. GET /api/workconnect/requests/outgoing - Outgoing requests
// ----------------------------------------------------
router.get("/requests/outgoing", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const requests = await WorkConnectSession.find({
      requester: userId,
      status: { $in: ["requested", "accepted", "active"] },
    })
      .populate("receiver", "firstName lastName email designation department employeeId profilePhoto")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ requests, count: requests.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 6. PUT /api/workconnect/requests/:sessionId/accept - Accept request
// ----------------------------------------------------
router.put("/requests/:sessionId/accept", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const { sessionId } = req.params;

    const session = await WorkConnectSession.findOne({ sessionId })
      .populate("requester", "firstName lastName email designation department profilePhoto")
      .populate("receiver", "firstName lastName email designation department profilePhoto");

    if (!session) return res.status(404).json({ message: "Session not found." });

    if (session.receiver._id.toString() !== userId) {
      return res.status(403).json({ message: "Only the designated recipient can accept this connection." });
    }

    if (session.status !== "requested") {
      return res.status(400).json({ message: `Session is already ${session.status}.` });
    }

    session.status = "active";
    session.startedAt = new Date();
    await session.save();

    // Mark both users as in-session
    await Promise.all([
      User.findByIdAndUpdate(session.requester._id, { workConnectStatus: "in-session", currentWorkConnectSessionId: sessionId }),
      User.findByIdAndUpdate(session.receiver._id, { workConnectStatus: "in-session", currentWorkConnectSessionId: sessionId }),
    ]);

    activePresence.set(session.requester._id.toString(), { status: "in-session", lastPing: Date.now(), sessionId });
    activePresence.set(session.receiver._id.toString(), { status: "in-session", lastPing: Date.now(), sessionId });

    // Inform requester via notification and socket
    await Notification.create({
      userId: session.requester._id,
      title: "WorkConnect Request Accepted",
      message: `${session.receiver.firstName} ${session.receiver.lastName} accepted your connection request. Collaboration workspace is now active.`,
      type: "meeting",
      link: `/?tab=workconnect&sub=active&session=${sessionId}`,
    }).catch(() => {});

    if (ioInstance) {
      ioInstance.to(session.requester._id.toString()).emit("workconnect_accepted", {
        sessionId,
        partner: {
          id: session.receiver._id,
          name: `${session.receiver.firstName} ${session.receiver.lastName}`,
        },
      });
      ioInstance.to(sessionId).emit("workconnect_session_ready", { sessionId });
    }

    res.json({ success: true, message: "Connection accepted.", session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 7. PUT /api/workconnect/requests/:sessionId/reject - Reject request
// ----------------------------------------------------
router.put("/requests/:sessionId/reject", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const { sessionId } = req.params;
    const { reason } = req.body;

    const session = await WorkConnectSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "Session not found." });

    if (session.receiver.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized to reject this session." });
    }

    session.status = "rejected";
    session.endedAt = new Date();
    session.endReason = reason || "Declined by recipient";
    await session.save();

    if (ioInstance) {
      ioInstance.to(session.requester.toString()).emit("workconnect_rejected", {
        sessionId,
        reason: session.endReason,
      });
    }

    res.json({ success: true, message: "Connection declined.", session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 8. PUT /api/workconnect/requests/:sessionId/cancel - Cancel request
// ----------------------------------------------------
router.put("/requests/:sessionId/cancel", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const { sessionId } = req.params;

    const session = await WorkConnectSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "Session not found." });

    if (session.requester.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized to cancel this session." });
    }

    session.status = "cancelled";
    session.endedAt = new Date();
    await session.save();

    if (ioInstance) {
      ioInstance.to(session.receiver.toString()).emit("workconnect_cancelled", { sessionId });
    }

    res.json({ success: true, message: "Request cancelled.", session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 9. GET /api/workconnect/sessions/active - Current active session
// ----------------------------------------------------
router.get("/sessions/active", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const active = await WorkConnectSession.findOne({
      $or: [{ requester: userId }, { receiver: userId }],
      status: "active",
    })
      .populate("requester", "firstName lastName email designation department profilePhoto employeeId")
      .populate("receiver", "firstName lastName email designation department profilePhoto employeeId")
      .sort({ updatedAt: -1 })
      .lean();

    // If admin, also return total active sessions count in organization
    let orgActiveCount = 0;
    if (req.user.role === "admin") {
      orgActiveCount = await WorkConnectSession.countDocuments({ status: "active" });
    }

    res.json({
      hasActiveSession: Boolean(active),
      session: active || null,
      orgActiveCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 10. GET /api/workconnect/sessions/:sessionId - Session details
// ----------------------------------------------------
router.get("/sessions/:sessionId", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const { sessionId } = req.params;

    const session = await WorkConnectSession.findOne({ sessionId })
      .populate("requester", "firstName lastName email designation department profilePhoto employeeId")
      .populate("receiver", "firstName lastName email designation department profilePhoto employeeId")
      .lean();

    if (!session) return res.status(404).json({ message: "Session not found." });

    const isParticipant =
      session.requester._id.toString() === userId ||
      session.receiver._id.toString() === userId ||
      req.user.role === "admin";

    if (!isParticipant) {
      return res.status(403).json({ message: "You are not authorized to view this session." });
    }

    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 11. PUT /api/workconnect/sessions/:sessionId/end - End session
// ----------------------------------------------------
router.put("/sessions/:sessionId/end", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const { sessionId } = req.params;
    const { reason, voiceUsed, videoUsed, annotationsCount } = req.body;

    const session = await WorkConnectSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "Session not found." });

    const isParticipant =
      session.requester.toString() === userId ||
      session.receiver.toString() === userId ||
      req.user.role === "admin";

    if (!isParticipant) {
      return res.status(403).json({ message: "Unauthorized to end this session." });
    }

    const endedAt = new Date();
    const startedAt = session.startedAt || session.createdAt;
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000));

    session.status = "ended";
    session.endedAt = endedAt;
    session.endedBy = req.user.id;
    session.endReason = reason || "Terminated by participant";
    session.durationSeconds = durationSeconds;
    if (voiceUsed !== undefined) session.voiceUsed = Boolean(voiceUsed);
    if (videoUsed !== undefined) session.videoUsed = Boolean(videoUsed);
    if (annotationsCount !== undefined) session.annotationsCount = Number(annotationsCount);
    session.screenSharing.isSharing = false;
    await session.save();

    // Reset user statuses
    await Promise.all([
      User.findByIdAndUpdate(session.requester, { workConnectStatus: "online", currentWorkConnectSessionId: "" }),
      User.findByIdAndUpdate(session.receiver, { workConnectStatus: "online", currentWorkConnectSessionId: "" }),
      WorkConnectSignal.deleteMany({ sessionId }),
    ]);

    activePresence.set(session.requester.toString(), { status: "online", lastPing: Date.now(), sessionId: "" });
    activePresence.set(session.receiver.toString(), { status: "online", lastPing: Date.now(), sessionId: "" });

    if (ioInstance) {
      ioInstance.to(sessionId).emit("workconnect_ended", {
        sessionId,
        endedBy: userId,
        durationSeconds,
      });
    }

    res.json({
      success: true,
      message: "Session ended successfully.",
      durationSeconds,
      session,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 12. POST /api/workconnect/sessions/:sessionId/summary - Add task assistance summary
// ----------------------------------------------------
router.post("/sessions/:sessionId/summary", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { summary, updateTask } = req.body;

    const session = await WorkConnectSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "Session not found." });

    session.assistanceSummary = summary || "";

    if (updateTask && session.attachedTask && session.attachedTask.taskId && summary) {
      const task = await Task.findById(session.attachedTask.taskId);
      if (task) {
        if (!Array.isArray(task.reviewComments)) {
          task.reviewComments = [];
        }
        task.reviewComments.push({
          author: req.user.id,
          authorName: `${req.user.firstName} ${req.user.lastName}`,
          authorRole: req.user.role || "Staff",
          comment: `[WorkConnect Remote Assistance Summary]: ${summary.trim()}`,
          decision: "reply",
          createdAt: new Date(),
        });
        await task.save();
        session.updatedTaskWithSummary = true;
      }
    }

    await session.save();

    res.json({ success: true, message: "Summary saved successfully.", session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 13. PUT /api/workconnect/sessions/:sessionId/permissions - Update session permissions
// ----------------------------------------------------
router.put("/sessions/:sessionId/permissions", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const { sessionId } = req.params;
    const { permissions, screenSharing } = req.body;

    const session = await WorkConnectSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "Session not found." });

    if (permissions) {
      if (permissions.allowScreenView !== undefined) session.permissions.allowScreenView = Boolean(permissions.allowScreenView);
      if (permissions.allowVoice !== undefined) session.permissions.allowVoice = Boolean(permissions.allowVoice);
      if (permissions.allowVideo !== undefined) session.permissions.allowVideo = Boolean(permissions.allowVideo);
      if (permissions.allowAnnotations !== undefined) session.permissions.allowAnnotations = Boolean(permissions.allowAnnotations);
    }

    if (screenSharing) {
      if (screenSharing.isSharing !== undefined) {
        session.screenSharing.isSharing = Boolean(screenSharing.isSharing);
        session.screenSharing.sharedBy = screenSharing.isSharing ? req.user.id : null;
        session.screenSharing.sharingStartedAt = screenSharing.isSharing ? new Date() : null;
      }
    }

    await session.save();

    if (ioInstance) {
      ioInstance.to(sessionId).emit("workconnect_permission_update", {
        sessionId,
        permissions: session.permissions,
        screenSharing: session.screenSharing,
        updatedBy: userId,
      });
    }

    res.json({ success: true, permissions: session.permissions, screenSharing: session.screenSharing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 14. POST /api/workconnect/sessions/:sessionId/signals - WebRTC / Annotation / Chat Relay
// ----------------------------------------------------
router.post("/sessions/:sessionId/signals", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { targetUserId, type, signal } = req.body;
    const senderId = req.user.id.toString();
    const senderName = `${req.user.firstName} ${req.user.lastName}`.trim();

    if (!targetUserId || !type || signal === undefined) {
      return res.status(400).json({ message: "targetUserId, type and signal are required." });
    }

    // Persist to MongoDB for cross-serverless / multi-instance delivery
    await WorkConnectSignal.create({
      sessionId,
      senderId,
      senderName,
      targetUserId: targetUserId.toString(),
      type,
      signal,
    }).catch((e) => console.warn("WorkConnect signal persist error:", e.message));

    // Relay immediately through Socket.IO if available
    if (ioInstance) {
      ioInstance.to(targetUserId.toString()).emit("workconnect_signal", {
        sessionId,
        senderId,
        senderName,
        type,
        signal,
        timestamp: Date.now(),
      });
    }

    res.json({ success: true, queued: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 15. GET /api/workconnect/sessions/:sessionId/signals - Retrieve queued signals
// ----------------------------------------------------
router.get("/sessions/:sessionId/signals", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id.toString();

    const queuedSignals = await WorkConnectSignal.find({
      sessionId,
      targetUserId: userId,
    }).sort({ createdAt: 1 }).lean();

    if (queuedSignals.length > 0) {
      const ids = queuedSignals.map((s) => s._id);
      await WorkConnectSignal.deleteMany({ _id: { $in: ids } }).catch(() => {});
    }

    // Also fetch current session status in case partner ended or updated
    const session = await WorkConnectSession.findOne({ sessionId })
      .select("status permissions screenSharing durationSeconds endedBy")
      .lean();

    res.json({
      signals: queuedSignals.map((s) => ({
        senderId: s.senderId,
        senderName: s.senderName,
        type: s.type,
        signal: s.signal,
        timestamp: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
      })),
      sessionStatus: session?.status || "ended",
      permissions: session?.permissions || {},
      screenSharing: session?.screenSharing || {},
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 16. GET /api/workconnect/history - Connection History & Analytics
// ----------------------------------------------------
router.get("/history", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const isAdmin = req.user.role === "admin";
    const { employeeId, department, status, startDate, endDate, q, limit = 50 } = req.query;

    const filter = {};

    if (!isAdmin) {
      filter.$or = [{ requester: userId }, { receiver: userId }];
    } else if (employeeId) {
      filter.$or = [{ requester: employeeId }, { receiver: employeeId }];
    }

    if (status && status !== "all") {
      filter.status = status;
    } else {
      filter.status = { $in: ["ended", "rejected", "cancelled", "active"] };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const sessions = await WorkConnectSession.find(filter)
      .populate("requester", "firstName lastName email designation department profilePhoto employeeId")
      .populate("receiver", "firstName lastName email designation department profilePhoto employeeId")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    // Client department or search text filtering
    let filtered = sessions;
    if (department && department !== "all") {
      filtered = filtered.filter(
        (s) => s.requester?.department === department || s.receiver?.department === department
      );
    }
    if (q && q.trim()) {
      const searchStr = q.toLowerCase().trim();
      filtered = filtered.filter(
        (s) =>
          s.sessionId.toLowerCase().includes(searchStr) ||
          `${s.requester?.firstName} ${s.requester?.lastName}`.toLowerCase().includes(searchStr) ||
          `${s.receiver?.firstName} ${s.receiver?.lastName}`.toLowerCase().includes(searchStr) ||
          s.requestReason.toLowerCase().includes(searchStr) ||
          s.attachedTask?.title?.toLowerCase().includes(searchStr)
      );
    }

    // Analytics computation
    const totalSessions = filtered.length;
    const completedSessions = filtered.filter((s) => s.status === "ended");
    const totalDurationSeconds = completedSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const screenShareCount = completedSessions.filter((s) => s.screenSharing?.sharingStartedAt || s.screenSharing?.isSharing).length;
    const voiceCount = completedSessions.filter((s) => s.voiceUsed).length;
    const videoCount = completedSessions.filter((s) => s.videoUsed).length;

    res.json({
      history: filtered,
      analytics: {
        totalSessions,
        completedSessions: completedSessions.length,
        totalDurationMinutes: Math.round(totalDurationSeconds / 60),
        avgDurationMinutes: completedSessions.length ? Math.round(totalDurationSeconds / completedSessions.length / 60) : 0,
        screenSharePct: completedSessions.length ? Math.round((screenShareCount / completedSessions.length) * 100) : 0,
        voicePct: completedSessions.length ? Math.round((voiceCount / completedSessions.length) * 100) : 0,
        videoPct: completedSessions.length ? Math.round((videoCount / completedSessions.length) * 100) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------------------------------------
// 17. GET /api/workconnect/connections/frequent - Frequent & Reporting lines
// ----------------------------------------------------
router.get("/connections/frequent", authMiddleware, workConnectAuth, async (req, res) => {
  try {
    const userId = req.user.id.toString();
    const currentUser = await User.findById(userId).populate("reportsTo", "firstName lastName designation department profilePhoto employeeId");

    // 1. Direct Reporting lines (Manager & Direct Subordinates)
    const subordinates = await User.find({ reportsTo: userId, status: { $ne: "disabled" } })
      .select("firstName lastName designation department profilePhoto employeeId")
      .lean();

    // 2. Recent assisted sessions
    const recentSessions = await WorkConnectSession.find({
      $or: [{ requester: userId }, { receiver: userId }],
      status: "ended",
    })
      .populate("requester", "firstName lastName designation department profilePhoto employeeId")
      .populate("receiver", "firstName lastName designation department profilePhoto employeeId")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const partnerCountMap = new Map();
    recentSessions.forEach((s) => {
      const partner = s.requester._id.toString() === userId ? s.receiver : s.requester;
      if (!partner) return;
      const pId = partner._id.toString();
      if (!partnerCountMap.has(pId)) {
        partnerCountMap.set(pId, { partner, count: 0, lastConnected: s.endedAt || s.createdAt });
      }
      partnerCountMap.get(pId).count += 1;
    });

    const frequentList = [...partnerCountMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((item) => ({
        ...item.partner,
        connectionCount: item.count,
        lastConnected: item.lastConnected,
      }));

    res.json({
      supervisor: currentUser.reportsTo || null,
      subordinates,
      frequent: frequentList,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = {
  router,
  setWorkConnectIO,
};
