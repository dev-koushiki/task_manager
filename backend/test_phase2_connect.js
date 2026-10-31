const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const User = require("./models/User");
const Meeting = require("./models/Meeting");

async function runPhase2Tests() {
  console.log("=================================================");
  console.log("TESTING PHASE 2: CALENDAR, CONNECT & VIDEO MEETINGS");
  console.log("=================================================\n");

  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager";
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("Connected to MongoDB successfully.\n");

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/meetings", meetingRoutes);

  const TEST_PORT = 5201;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://localhost:${TEST_PORT}/api`;

  let passed = 0;
  let total = 0;

  function assert(condition, msg) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  try {
    const timestamp = Date.now();
    const hostEmail = `host_${timestamp}@connecttest.com`;
    const participantEmail = `guest_${timestamp}@connecttest.com`;

    // 1. Register Host and Invite Participant
    console.log("--- 1. Register Host and Participant Users ---");
    const resHost = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Host",
        lastName: "User",
        email: hostEmail,
        password: "Password123!",
        companyName: `Connect Corp ${timestamp}`,
        designation: "Project Director",
      }),
    });
    const hostData = await resHost.json();
    assert(resHost.status === 201, "Host registered successfully");
    const hostToken = hostData.token;
    const hostId = hostData.user.id || hostData.user._id;

    const resInvite = await fetch(`${BASE_URL}/admin/employees/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        name: "Guest Member",
        email: participantEmail,
        department: "Engineering & Technology",
        role: "employee",
      }),
    });
    const inviteData = await resInvite.json();
    assert(resInvite.status === 201, "Participant invited to workspace");

    const resAccept = await fetch(`${BASE_URL}/auth/register/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken: inviteData.inviteToken,
        password: "Password123!",
      }),
    });
    const acceptData = await resAccept.json();
    assert(resAccept.status === 201, "Guest participant joined workspace successfully");
    const guestToken = acceptData.token;
    const guestId = acceptData.user.id || acceptData.user._id;

    // 2. Schedule Meeting: Online Mode
    console.log("\n--- 2. Schedule Online Meeting (Auto roomCode & Connect integration) ---");
    const testDate = "2026-11-10";

    const resOnlineMeet = await fetch(`${BASE_URL}/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: "Sprint Planning - Online Connect",
        agenda: "Review milestones and deliverables",
        date: testDate,
        startTime: "14:00",
        endTime: "15:00",
        mode: "online",
        participants: [{ userId: guestId, name: "Guest Member", email: participantEmail }],
      }),
    });
    const onlineMeetData = await resOnlineMeet.json();
    assert(resOnlineMeet.status === 201, "Online meeting created successfully");
    const createdOnline = onlineMeetData.meeting || onlineMeetData;
    assert(createdOnline.mode === "online", "Meeting mode saved as 'online'");
    assert(typeof createdOnline.roomCode === "string" && createdOnline.roomCode.length > 5, "Secure roomCode automatically generated");
    const onlineMeetingId = createdOnline._id;
    const onlineRoomCode = createdOnline.roomCode;

    // 3. Schedule Meeting: Offline Mode
    console.log("\n--- 3. Schedule Offline Meeting (Physical Location) ---");
    const resOfflineMeet = await fetch(`${BASE_URL}/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: "Architecture Review - Offline Boardroom",
        agenda: "Physical whiteboard discussion",
        date: testDate,
        startTime: "16:00",
        endTime: "17:00",
        mode: "offline",
        location: "Conference Room 4B, 3rd Floor",
        participants: [{ userId: guestId, name: "Guest Member", email: participantEmail }],
      }),
    });
    const offlineMeetData = await resOfflineMeet.json();
    assert(resOfflineMeet.status === 201, "Offline meeting created successfully");
    const createdOffline = offlineMeetData.meeting || offlineMeetData;
    assert(createdOffline.mode === "offline", "Meeting mode saved as 'offline'");
    assert(createdOffline.location === "Conference Room 4B, 3rd Floor", "Physical location saved in Calendar");

    // 4. Connect Instant Room Creation
    console.log("\n--- 4. Instant Connect Room Creation ---");
    const resInstant = await fetch(`${BASE_URL}/meetings/rooms/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: "Instant Collaboration Session",
        agenda: "Ad-hoc debugging",
      }),
    });
    const instantData = await resInstant.json();
    assert(resInstant.status === 201, "Instant Connect meeting room created");
    assert(instantData.roomCode && instantData.roomCode.length >= 6, "Instant room code assigned");
    const testRoomCode = instantData.roomCode;

    // 5. Connect Room Lookup & Permissions
    console.log("\n--- 5. Connect Room Lookup & Access ---");
    const resGetRoom = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}`, {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    const roomDetails = await resGetRoom.json();
    assert(resGetRoom.status === 200, "Room details retrieved successfully");
    assert((roomDetails.meeting?.roomCode || roomDetails.roomCode) === testRoomCode, "Room code matches request");
    assert((roomDetails.meeting?.mode || roomDetails.mode) === "online", "Room mode is verified online");

    // 6. Connect Room Join & Attendance Tracking
    console.log("\n--- 6. Join Room & Record Attendance ---");
    const resHostJoin = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    assert(resHostJoin.status === 200, "Host joined meeting successfully");

    const resGuestJoin = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    assert(resGuestJoin.status === 200, "Guest joined meeting successfully");

    // Check attendance in room details
    const resRoomWithAttendance = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const roomWithAtt = await resRoomWithAttendance.json();
    const attendanceList = roomWithAtt.meeting?.attendance || roomWithAtt.attendance || [];
    assert(attendanceList.length >= 2, "Attendance records created for both participants");
    const guestAtt = attendanceList.find((a) => String(a.userId?._id || a.userId) === String(guestId));
    assert(guestAtt && guestAtt.leftAt === null, "Participant attendance record is active (leftAt is null)");

    // 7. WebRTC Signaling Dispatch & Retrieval
    console.log("\n--- 7. WebRTC Signaling (Offers, Answers, ICE Candidates) ---");
    const resSignalOffer = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        type: "offer",
        targetUserId: guestId,
        sdp: "v=0\r\no=host 123456 2 IN IP4 127.0.0.1...",
      }),
    });
    const signalOfferData = await resSignalOffer.json();
    assert(resSignalOffer.status === 200 && signalOfferData.success, "WebRTC offer signal queued");

    const resGetSignals = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/signals?since=0`, {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    const signalsResp = await resGetSignals.json();
    const guestSignals = Array.isArray(signalsResp) ? signalsResp : (signalsResp.signals || []);
    assert(Array.isArray(guestSignals) && guestSignals.length >= 1, "Guest received queued WebRTC signals");
    assert(guestSignals[0].type === "offer", "Signal received is WebRTC offer");

    // 8. Meeting In-Call Chat
    console.log("\n--- 8. Meeting In-Call Chat Messages ---");
    const resPostChat = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({
        message: "Hello everyone, my camera and mic are working!",
      }),
    });
    const postChatData = await resPostChat.json();
    assert(resPostChat.status === 201, "Chat message posted to meeting room");
    assert(postChatData.chatMessage.text === "Hello everyone, my camera and mic are working!", "Chat message text verified");

    const resGetChat = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/chat`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const chatList = await resGetChat.json();
    assert(Array.isArray(chatList) && chatList.length >= 1, "Host retrieved chat message list");
    assert(chatList[0].senderName.includes("Guest"), "Chat sender attribution preserved");

    // 9. Host Controls (Mute All & Lock Room)
    console.log("\n--- 9. Host Controls: Mute All & Lock Meeting ---");
    const resHostMute = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/host-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ action: "mute_all" }),
    });
    const muteData = await resHostMute.json();
    assert(resHostMute.status === 200 && muteData.hostControls.muteAll === true, "Host muted all participants");

    const resHostLock = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/host-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({ action: "lock" }),
    });
    const lockData = await resHostLock.json();
    assert(resHostLock.status === 200 && lockData.hostControls.lockMeeting === true, "Host locked meeting room");

    // 10. Participant Leaves Room & Attendance Duration
    console.log("\n--- 10. Participant Leaves & Calculates Attendance Duration ---");
    const resGuestLeave = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    const guestLeaveData = await resGuestLeave.json();
    assert(resGuestLeave.status === 200, "Guest left meeting room");

    const resRoomAfterLeave = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const roomAfterLeave = await resRoomAfterLeave.json();
    const attendanceAfterLeave = roomAfterLeave.meeting?.attendance || roomAfterLeave.attendance || [];
    const guestRecord = attendanceAfterLeave.find((a) => String(a.userId?._id || a.userId) === String(guestId));
    assert(guestRecord && guestRecord.leftAt !== null, "Guest attendance record updated with leave timestamp");

    // 11. Host Ends Meeting for All
    console.log("\n--- 11. Host Ends Meeting ---");
    const resEndMeet = await fetch(`${BASE_URL}/meetings/rooms/${testRoomCode}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const endMeetData = await resEndMeet.json();
    assert(resEndMeet.status === 200, "Host ended meeting successfully");
    const finalMeetingStatus = endMeetData.meeting?.status || endMeetData.status;
    assert(finalMeetingStatus === "completed", "Meeting status marked as completed");

    // 12. Meeting History & Attendance Records
    console.log("\n--- 12. Meeting History & Attendance Audit Logs ---");
    const resHistory = await fetch(`${BASE_URL}/meetings/history/records`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const historyData = await resHistory.json();
    assert(resHistory.status === 200 && Array.isArray(historyData), "Meeting history retrieved");
    const endedMeetingInHistory = historyData.find((m) => m.roomCode === testRoomCode);
    assert(endedMeetingInHistory !== undefined, "Completed Connect meeting appears in history records");
    assert(endedMeetingInHistory.attendance.length >= 2, "Attendance records present in meeting history");

    // 13. Google OAuth & Calendar Sync Check
    console.log("\n--- 13. Google Integration & OAuth Token Endpoints ---");
    const resGoogleStatus = await fetch(`${BASE_URL}/meetings/google/status`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const googleStatus = await resGoogleStatus.json();
    assert(resGoogleStatus.status === 200, "Google status endpoint returned 200");
    assert(googleStatus.connected === false, "Host Google account correctly shows unconnected initially");

    const resGoogleAuthUrl = await fetch(`${BASE_URL}/meetings/google/auth-url`, {
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const authUrlData = await resGoogleAuthUrl.json();
    assert(resGoogleAuthUrl.status === 200, "Google OAuth URL endpoint functional");

    const resSyncWithoutOAuth = await fetch(`${BASE_URL}/meetings/${onlineMeetingId}/sync-google`, {
      method: "POST",
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const syncErrorData = await resSyncWithoutOAuth.json();
    assert(resSyncWithoutOAuth.status === 400, "Sync returns 400 when Google account is not connected");
    assert(syncErrorData.message.includes("Google"), "Helpful error message returned regarding Google connection");

    // 14. LiveKit Token Generation Endpoint
    console.log("\n--- 14. LiveKit Token Generation Endpoint ---");
    const resLkToken = await fetch(`${BASE_URL}/meetings/rooms/${onlineRoomCode}/livekit-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    const lkData = await resLkToken.json();
    assert(resLkToken.status === 200, "LiveKit token endpoint returned 200");
    assert(typeof lkData.livekitEnabled === "boolean", "Returned LiveKit status information (configured or built-in WebRTC fallback)");

    console.log("\n=================================================");
    console.log(`ALL PHASE 2 TESTS PASSED! (${passed}/${total})`);
    console.log("=================================================");
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exitCode = 1;
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runPhase2Tests();
