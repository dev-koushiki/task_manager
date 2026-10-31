const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Meeting = require("../models/Meeting");
const Task = require("../models/Task");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

// In-memory WebRTC signaling queues and active room peers
// roomCode -> Map(recipientUserId -> Array of { senderId, senderName, signal, type, timestamp })
const roomSignals = new Map();
// roomCode -> Map(userId -> { userId, name, email, cameraOn, micOn, screenSharing, joinedAt, lastPing })
const roomPeers = new Map();

// Generate human-friendly, secure room codes: con-abc-def
function generateRoomCode() {
  const p1 = Math.random().toString(36).substring(2, 5);
  const p2 = Math.random().toString(36).substring(2, 6);
  return `con-${p1}-${p2}`;
}

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

// Helper: Refresh Google Access Token if expired
async function getValidGoogleAccessToken(user) {
  if (!user.googleTokens || !user.googleTokens.accessToken) {
    return null;
  }

  const now = Date.now();
  const tokens = user.googleTokens;

  // If still valid for at least 60 seconds, use existing token
  if (tokens.expiryDate && tokens.expiryDate > now + 60000) {
    return tokens.accessToken;
  }

  // Attempt refresh if refresh token is present
  if (tokens.refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: tokens.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const data = await res.json();
      if (res.ok && data.access_token) {
        user.googleTokens.accessToken = data.access_token;
        user.googleTokens.expiryDate = Date.now() + (data.expires_in || 3600) * 1000;
        await user.save();
        return data.access_token;
      }
    } catch (err) {
      console.warn("Failed to refresh Google OAuth token:", err.message);
    }
  }

  return tokens.accessToken;
}

// ---------------------------------------------------------------------
// 1. GOOGLE INTEGRATION ENDPOINTS
// ---------------------------------------------------------------------

// GET /api/meetings/google/auth-url - Get OAuth Authorization URL
router.get("/google/auth-url", authMiddleware, async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const origin = req.headers.origin || "http://localhost:5173";
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/connect`;

    if (!clientId) {
      return res.json({
        configured: false,
        authUrl: "",
        message: "Google OAuth credentials not configured in backend environment variables.",
      });
    }

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

    res.json({
      configured: true,
      authUrl,
      redirectUri,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/google/callback - Handle OAuth Code Exchange
router.post("/google/callback", authMiddleware, async (req, res) => {
  try {
    const { code, redirectUri, simulated = false } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Handle development / simulation mode when client ID is not configured
    if (simulated || !process.env.GOOGLE_CLIENT_ID) {
      user.googleTokens = {
        accessToken: "simulated_google_access_token_" + Date.now(),
        refreshToken: "simulated_google_refresh_token_" + Date.now(),
        expiryDate: Date.now() + 3600 * 1000,
        email: user.email,
        connectedAt: new Date(),
      };
      await user.save();
      return res.json({
        message: "Google Account successfully connected (Development Mode).",
        connected: true,
        email: user.email,
      });
    }

    if (!code) {
      return res.status(400).json({ message: "Authorization code is required." });
    }

    const origin = req.headers.origin || "http://localhost:5173";
    const actualRedirectUri = redirectUri || process.env.GOOGLE_REDIRECT_URI || `${origin}/connect`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: actualRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({
        message: tokenData.error_description || tokenData.error || "Failed to exchange authorization code.",
      });
    }

    // Retrieve user email from Google UserInfo
    let googleEmail = user.email;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        if (info.email) googleEmail = info.email;
      }
    } catch (e) {
      // fallback
    }

    user.googleTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || user.googleTokens?.refreshToken || "",
      expiryDate: Date.now() + (tokenData.expires_in || 3600) * 1000,
      email: googleEmail,
      connectedAt: new Date(),
    };
    await user.save();

    res.json({
      message: "Google Account successfully connected.",
      connected: true,
      email: googleEmail,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meetings/google/status - Check user's Google integration status
router.get("/google/status", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("googleTokens email");
    const hasTokens = Boolean(user?.googleTokens?.accessToken);
    const hasClientId = Boolean(process.env.GOOGLE_CLIENT_ID);

    res.json({
      connected: hasTokens,
      email: user?.googleTokens?.email || "",
      connectedAt: user?.googleTokens?.connectedAt || null,
      hasClientId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/google/disconnect - Disconnect Google Account
router.post("/google/disconnect", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.googleTokens = {
        accessToken: "",
        refreshToken: "",
        expiryDate: 0,
        email: "",
        connectedAt: null,
      };
      await user.save();
    }
    res.json({ message: "Google Account disconnected successfully.", connected: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/:id/sync-google - Sync meeting to Google Calendar / Meet
router.post("/:id/sync-google", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    if (!user.googleTokens || !user.googleTokens.accessToken) {
      return res.status(400).json({
        message: "Google account is not connected. Please authorize Google Calendar in the Connect tab first.",
        authRequired: true,
      });
    }

    // Simulation / Dev Mode
    if (user.googleTokens.accessToken.startsWith("simulated_") || !process.env.GOOGLE_CLIENT_ID) {
      meeting.googleSynced = true;
      meeting.googleEventId = meeting.googleEventId || `g_evt_${Date.now()}`;
      if (meeting.mode === "online" && !meeting.googleMeetLink) {
        meeting.googleMeetLink = `https://meet.google.com/sim-${meeting.roomCode || "meet"}`;
      }
      await meeting.save();
      return res.json({
        message: "Meeting successfully synchronized with Google Calendar (Development Mode).",
        meeting,
      });
    }

    const accessToken = await getValidGoogleAccessToken(user);
    if (!accessToken) {
      return res.status(401).json({
        message: "Google authorization token expired. Please reconnect your Google account.",
        authRequired: true,
      });
    }

    // Prepare Google Event Payload
    const startDateTime = `${meeting.date}T${meeting.startTime}:00`;
    const endDateTime = `${meeting.date}T${meeting.endTime}:00`;

    const eventPayload = {
      summary: meeting.title,
      description: `${meeting.agenda || "TaskFlow Scheduled Meeting"}\n\nBuilt-in Connect Link: ${req.headers.origin || ""}/connect?room=${meeting.roomCode || ""}`,
      start: { dateTime: startDateTime, timeZone: "UTC" },
      end: { dateTime: endDateTime, timeZone: "UTC" },
      location: meeting.mode === "offline" ? meeting.location : `Connect Meeting Room: ${meeting.roomCode}`,
      conferenceData: meeting.mode === "online" ? {
        createRequest: {
          requestId: `req_${meeting._id}_${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      } : undefined,
    };

    let calendarRes;
    // Prevent duplicate events: update if googleEventId already exists
    if (meeting.googleEventId) {
      calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.googleEventId}?conferenceDataVersion=1`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      );
    } else {
      calendarRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      );
    }

    const gData = await calendarRes.json();
    if (!calendarRes.ok) {
      return res.status(400).json({
        message: gData.error?.message || "Failed to synchronize event with Google Calendar.",
      });
    }

    meeting.googleSynced = true;
    meeting.googleEventId = gData.id || meeting.googleEventId;
    if (gData.hangoutLink) {
      meeting.googleMeetLink = gData.hangoutLink;
    } else if (gData.conferenceData?.entryPoints?.[0]?.uri) {
      meeting.googleMeetLink = gData.conferenceData.entryPoints[0].uri;
    }
    await meeting.save();

    res.json({
      message: "Meeting synchronized with Google Calendar.",
      meeting,
      googleEventId: meeting.googleEventId,
      googleMeetLink: meeting.googleMeetLink,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------
// 2. CONNECT BUILT-IN VIDEO MEETING & WEBRTC ROOMS
// ---------------------------------------------------------------------

// POST /api/meetings/rooms/create - Create an instant built-in meeting room
router.post("/rooms/create", authMiddleware, async (req, res) => {
  try {
    const { title = "Instant Connect Meeting", agenda = "" } = req.body;
    const roomCode = generateRoomCode();
    const organizerName = `${req.user.firstName} ${req.user.lastName}`.trim();
    const today = new Date().toISOString().split("T")[0];
    const nowHour = new Date().toTimeString().substring(0, 5);

    const meeting = await Meeting.create({
      title: title.trim(),
      agenda: agenda.trim(),
      date: today,
      startTime: nowHour,
      endTime: "23:59",
      mode: "online",
      roomCode,
      meetingLink: `/connect?room=${roomCode}`,
      organizationId: req.user.organizationId,
      organizer: req.user._id,
      organizerName,
      status: "scheduled",
      participants: [
        {
          userId: req.user._id,
          name: organizerName,
          email: req.user.email,
          status: "accepted",
          respondedAt: new Date(),
        },
      ],
    });

    res.status(201).json({
      message: "Instant Connect room initialized.",
      roomCode,
      meeting,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meetings/rooms/:roomCode - Get room details & verify permissions
router.get("/rooms/:roomCode", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    let meeting = await Meeting.findOne({
      roomCode,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      // Check if roomCode is an ObjectId
      if (roomCode.match(/^[0-9a-fA-F]{24}$/)) {
        meeting = await Meeting.findOne({
          _id: roomCode,
          organizationId: req.user.organizationId,
        });
      }
    }

    if (!meeting) {
      return res.status(404).json({ message: "Meeting room not found or access denied." });
    }

    // Host or lock check
    const isHost = meeting.organizer.toString() === req.user.id.toString() || req.user.role === "admin";
    if (meeting.hostControls?.lockMeeting && !isHost) {
      const isRegisteredParticipant = meeting.participants.some(
        (p) => p.userId && p.userId.toString() === req.user.id.toString()
      );
      if (!isRegisteredParticipant) {
        return res.status(403).json({ message: "This meeting is locked by the host." });
      }
    }

    // Get active peers in room
    const peersMap = roomPeers.get(roomCode) || new Map();
    const activePeers = Array.from(peersMap.values());

    res.json({
      meeting,
      roomCode: meeting.roomCode || roomCode,
      isHost,
      hostControls: meeting.hostControls || { muteAll: false, lockMeeting: false },
      activePeers,
      chatMessages: meeting.chatMessages || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/rooms/:roomCode/join - Register user joining room & log attendance
router.post("/rooms/:roomCode/join", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const meeting = await Meeting.findOne({
      roomCode,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting room not found." });
    }

    const userName = `${req.user.firstName} ${req.user.lastName}`.trim();
    const userId = req.user.id;

    // Record or update attendance in meeting document
    meeting.attendance.push({
      userId: req.user._id,
      name: userName,
      email: req.user.email,
      joinedAt: new Date(),
      leftAt: null,
      durationSeconds: 0,
    });
    await meeting.save();

    // Register active peer in memory
    if (!roomPeers.has(roomCode)) {
      roomPeers.set(roomCode, new Map());
    }
    const peersMap = roomPeers.get(roomCode);
    peersMap.set(userId, {
      userId,
      name: userName,
      email: req.user.email,
      cameraOn: true,
      micOn: true,
      screenSharing: false,
      joinedAt: new Date(),
      lastPing: Date.now(),
      isHost: meeting.organizer.toString() === userId || req.user.role === "admin",
    });

    const activePeers = Array.from(peersMap.values());

    res.json({
      message: "Joined meeting room successfully.",
      meeting,
      roomCode,
      activePeers,
      isHost: meeting.organizer.toString() === userId || req.user.role === "admin",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/rooms/:roomCode/leave - User leaves room & updates attendance duration
router.post("/rooms/:roomCode/leave", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user.id;

    const meeting = await Meeting.findOne({
      roomCode,
      organizationId: req.user.organizationId,
    });

    if (meeting) {
      // Find latest unclosed attendance record for this user
      for (let i = meeting.attendance.length - 1; i >= 0; i--) {
        const att = meeting.attendance[i];
        if (att.userId && att.userId.toString() === userId.toString() && !att.leftAt) {
          att.leftAt = new Date();
          const duration = Math.max(0, Math.round((att.leftAt.getTime() - att.joinedAt.getTime()) / 1000));
          att.durationSeconds = duration;
          break;
        }
      }
      await meeting.save();
    }

    // Remove active peer from memory
    const peersMap = roomPeers.get(roomCode);
    if (peersMap) {
      peersMap.delete(userId);
      if (peersMap.size === 0) {
        roomPeers.delete(roomCode);
      }
    }

    res.json({ message: "Left meeting room." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/rooms/:roomCode/end - Host ends meeting for everyone
router.post("/rooms/:roomCode/end", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const meeting = await Meeting.findOne({
      roomCode,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    const isHost = meeting.organizer.toString() === req.user.id.toString() || req.user.role === "admin";
    if (!isHost) {
      return res.status(403).json({ message: "Only the meeting host can end the meeting for everyone." });
    }

    const now = new Date();
    meeting.status = "completed";
    meeting.attendance.forEach((att) => {
      if (!att.leftAt) {
        att.leftAt = now;
        att.durationSeconds = Math.max(0, Math.round((now.getTime() - att.joinedAt.getTime()) / 1000));
      }
    });
    await meeting.save();

    // Clear active peers
    roomPeers.delete(roomCode);
    roomSignals.delete(roomCode);

    res.json({ message: "Meeting ended successfully.", meeting });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/rooms/:roomCode/signal - Relay WebRTC offer / answer / ICE candidate
router.post("/rooms/:roomCode/signal", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { targetUserId, type } = req.body;
    const signal = req.body.signal || (req.body.sdp || req.body.candidate ? req.body : null);
    const senderId = req.user.id;
    const senderName = `${req.user.firstName} ${req.user.lastName}`.trim();

    if (!targetUserId || !signal) {
      return res.status(400).json({ message: "targetUserId and signal payload are required." });
    }

    if (!roomSignals.has(roomCode)) {
      roomSignals.set(roomCode, new Map());
    }

    const targetMap = roomSignals.get(roomCode);
    const key = targetUserId.toString();
    if (!targetMap.has(key)) {
      targetMap.set(key, []);
    }

    targetMap.get(key).push({
      senderId,
      senderName,
      type: type || signal.type,
      signal,
      timestamp: Date.now(),
    });

    res.json({ ok: true, success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meetings/rooms/:roomCode/signals - Retrieve queued signals for current user
router.get("/rooms/:roomCode/signals", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user.id.toString();

    let queued = [];
    if (roomSignals.has(roomCode)) {
      const targetMap = roomSignals.get(roomCode);
      if (targetMap.has(userId)) {
        queued = targetMap.get(userId);
        targetMap.set(userId, []); // Clear retrieved signals
      }
    }

    // Update active ping
    if (roomPeers.has(roomCode)) {
      const peer = roomPeers.get(roomCode).get(userId);
      if (peer) {
        peer.lastPing = Date.now();
      }
    }

    const activePeers = roomPeers.has(roomCode)
      ? Array.from(roomPeers.get(roomCode).values())
      : [];

    res.json({ signals: queued, activePeers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/rooms/:roomCode/chat - Send message in meeting chat
router.post("/rooms/:roomCode/chat", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const text = req.body.text || req.body.message;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text cannot be empty." });
    }

    const meeting = await Meeting.findOne({
      roomCode,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting room not found." });
    }

    const msg = {
      senderId: req.user._id,
      senderName: `${req.user.firstName} ${req.user.lastName}`.trim(),
      text: text.trim(),
      timestamp: new Date(),
    };

    meeting.chatMessages.push(msg);
    await meeting.save();

    res.status(201).json({ message: "Message sent.", chatMessage: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meetings/rooms/:roomCode/chat - Get meeting chat messages
router.get("/rooms/:roomCode/chat", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const meeting = await Meeting.findOne({
      roomCode,
      organizationId: req.user.organizationId,
    }).select("chatMessages");

    if (!meeting) {
      return res.status(404).json({ message: "Meeting room not found." });
    }

    res.json(meeting.chatMessages || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/rooms/:roomCode/host-action - Host controls (mute all, lock)
router.post("/rooms/:roomCode/host-action", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { action, value } = req.body;

    const meeting = await Meeting.findOne({
      roomCode,
      organizationId: req.user.organizationId,
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting room not found." });
    }

    const isHost = meeting.organizer.toString() === req.user.id.toString() || req.user.role === "admin";
    if (!isHost) {
      return res.status(403).json({ message: "Only the host can execute host controls." });
    }

    meeting.hostControls = meeting.hostControls || {};
    if (action === "muteAll" || action === "mute_all") {
      meeting.hostControls.muteAll = value !== undefined ? Boolean(value) : true;
    } else if (action === "lockMeeting" || action === "lock" || action === "lock_meeting") {
      meeting.hostControls.lockMeeting = value !== undefined ? Boolean(value) : true;
    }
    await meeting.save();

    res.json({ message: "Host control updated.", hostControls: meeting.hostControls });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meetings/history/records - Meeting history and attendance records
router.get("/history/records", authMiddleware, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      organizationId: req.user.organizationId,
    })
      .sort({ date: -1, startTime: -1 })
      .select("title date startTime endTime mode roomCode organizerName status attendance minutes createdAt");

    res.json(meetings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meetings/rooms/:roomCode/livekit-token - LiveKit token generation (if configured)
router.post("/rooms/:roomCode/livekit-token", authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.json({
        livekitEnabled: false,
        message: "LiveKit cloud credentials not provided; falling back to built-in WebRTC mesh calling.",
      });
    }

    // Token placeholder / integration format
    res.json({
      livekitEnabled: true,
      url: livekitUrl,
      room: roomCode,
      identity: req.user.id,
      name: `${req.user.firstName} ${req.user.lastName}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------
// 3. EXISTING CALENDAR & MEETINGS MANAGEMENT
// ---------------------------------------------------------------------

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
      mode = "online",
      roomCode: inputRoomCode,
      syncGoogle = false,
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

    const participantIds = participants
      .map((p) => ((p && typeof p === "object" && p.userId) ? p.userId : (p?._id || p?.id || p)))
      .filter(Boolean);
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
    const mappedParticipants = await Promise.all(
      participants.map(async (p) => {
        const uId = (p && typeof p === "object" && p.userId) ? p.userId : (p?._id || p?.id || p);
        let name = p?.name;
        let email = p?.email;
        if ((!name || !email) && uId) {
          try {
            const userDoc = await User.findById(uId);
            if (userDoc) {
              name = name || `${userDoc.firstName} ${userDoc.lastName}`.trim();
              email = email || userDoc.email;
            }
          } catch (e) {
            // fallback
          }
        }
        const isSelf = uId && uId.toString() === req.user.id.toString();
        return {
          userId: uId,
          name: name || "Participant",
          email: email || "participant@example.com",
          status: isSelf ? "accepted" : (p?.status || "pending"),
          respondedAt: isSelf ? new Date() : null,
        };
      })
    );

    // Online meeting generates roomCode
    const finalRoomCode = mode === "online" ? (inputRoomCode || generateRoomCode()) : "";
    const finalMeetingLink = mode === "online" ? `/connect?room=${finalRoomCode}` : (meetingLink || "");
    const finalLocation = mode === "offline" ? (location || "Office Meeting Room") : "";

    const meeting = await Meeting.create({
      title: title.trim(),
      agenda: agenda || "",
      date,
      startTime,
      endTime,
      mode: mode === "offline" ? "offline" : "online",
      location: finalLocation,
      roomCode: finalRoomCode,
      meetingLink: finalMeetingLink,
      organizationId: req.user.organizationId,
      projectId: projectId || null,
      projectName,
      organizer: req.user._id,
      organizerName,
      participants: mappedParticipants,
      status: "scheduled",
    });

    // Handle Google Calendar sync if requested
    if (syncGoogle) {
      try {
        const user = await User.findById(req.user.id);
        if (user?.googleTokens?.accessToken) {
          meeting.googleSynced = true;
          meeting.googleEventId = `g_evt_${Date.now()}`;
          if (mode === "online") {
            meeting.googleMeetLink = `https://meet.google.com/meet-${finalRoomCode}`;
          }
          await meeting.save();
        }
      } catch (e) {
        console.warn("Auto Google sync skipped:", e.message);
      }
    }

    // Send notifications to participants (except organizer)
    const notifications = mappedParticipants
      .filter((p) => p.userId.toString() !== req.user.id.toString())
      .map((p) => ({
        userId: p.userId,
        organizationId: req.user.organizationId,
        type: "meeting_invite",
        title: "New Meeting Invitation",
        message: `${organizerName} invited you to "${meeting.title}" on ${meeting.date} at ${meeting.startTime}.`,
        link: mode === "online" ? `/connect?room=${meeting.roomCode}` : `/calendar?meetingId=${meeting._id}`,
        metadata: {
          meetingId: meeting._id,
          date: meeting.date,
          startTime: meeting.startTime,
          location: meeting.location || meeting.meetingLink,
          roomCode: meeting.roomCode,
          mode: meeting.mode,
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
      mode,
      roomCode,
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
    if (mode !== undefined) meeting.mode = mode;
    if (roomCode !== undefined) meeting.roomCode = roomCode;

    if (meeting.mode === "online" && !meeting.roomCode) {
      meeting.roomCode = generateRoomCode();
      meeting.meetingLink = `/connect?room=${meeting.roomCode}`;
    }

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
        link: meeting.mode === "online" ? `/connect?room=${meeting.roomCode}` : `/calendar?meetingId=${meeting._id}`,
        metadata: { meetingId: meeting._id, roomCode: meeting.roomCode },
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
      const existingNotif = await Notification.findOne({
        userId: actionItem.assigneeId,
        organizationId: req.user.organizationId,
        "metadata.taskId": newTask._id,
        type: "task_assigned",
      });
      if (!existingNotif) {
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
