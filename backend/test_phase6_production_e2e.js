const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const MeetingSignal = require("./models/MeetingSignal");
const Meeting = require("./models/Meeting");

async function runProductionE2ETests() {
  console.log("=================================================");
  console.log("PHASE 6: TWO-ACCOUNT END-TO-END CONNECT SYSTEM TEST");
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

  const TEST_PORT = 5202;
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
    const adminEmail = `admin_${timestamp}@workplace.com`;
    const employeeEmail = `emp_${timestamp}@workplace.com`;

    // 1. Setup Admin and Employee Accounts
    console.log("--- 1. Authenticate Admin and Employee Accounts ---");
    const resAdminReg = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Sarah",
        lastName: "Connor",
        email: adminEmail,
        password: "Password123!",
        companyName: `Cyberdyne Systems ${timestamp}`,
        designation: "Executive Director",
      }),
    });
    const adminData = await resAdminReg.json();
    assert(resAdminReg.status === 201, "Admin registered and received JWT token");
    const adminToken = adminData.token;
    const adminId = String(adminData.user.id || adminData.user._id);

    // Invite Employee
    const resInvite = await fetch(`${BASE_URL}/admin/employees/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "John Connor",
        email: employeeEmail,
        department: "Engineering & Technology",
        role: "employee",
      }),
    });
    const inviteData = await resInvite.json();
    assert(resInvite.status === 201, "Employee invited to organization");

    // Accept Invite as Employee
    const resAccept = await fetch(`${BASE_URL}/auth/register/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken: inviteData.inviteToken,
        password: "Password123!",
      }),
    });
    const acceptData = await resAccept.json();
    assert(resAccept.status === 201, "Employee accepted invite and received JWT token");
    const employeeToken = acceptData.token;
    const employeeId = String(acceptData.user.id || acceptData.user._id);

    // 2. Admin Creates Instant Meeting
    console.log("\n--- 2. Admin Creates Meeting Room ---");
    const resCreateRoom = await fetch(`${BASE_URL}/meetings/rooms/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ title: "Sprint Architecture Sync" }),
    });
    const roomData = await resCreateRoom.json();
    assert(resCreateRoom.status === 201 && roomData.roomCode, "Admin created instant Connect meeting room");
    const roomCode = roomData.roomCode;
    console.log(`  Room Code: ${roomCode}`);

    // 3. Admin Joins Meeting Room
    console.log("\n--- 3. Admin Joins Meeting Room ---");
    const resAdminJoin = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminJoinData = await resAdminJoin.json();
    assert(resAdminJoin.status === 200, "Admin joined meeting room");
    assert(adminJoinData.isHost === true, "Admin designated as meeting host");

    // 4. Employee Joins Meeting Room
    console.log("\n--- 4. Employee Joins Meeting Room ---");
    const resEmpJoin = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const empJoinData = await resEmpJoin.json();
    assert(resEmpJoin.status === 200, "Employee joined meeting room");

    // 5. Participant Visibility & Synchronization
    console.log("\n--- 5. Participant Synchronization (Both See Each Other) ---");
    const resSignalsAdmin = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminSignalView = await resSignalsAdmin.json();
    assert(adminSignalView.activePeers.length === 2, "Admin sees 2 active peers in room");
    const hasEmployee = adminSignalView.activePeers.some((p) => String(p.userId) === employeeId);
    assert(hasEmployee, "Admin sees Employee in active peers list");

    const resSignalsEmp = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const empSignalView = await resSignalsEmp.json();
    assert(empSignalView.activePeers.length === 2, "Employee sees 2 active peers in room");
    const hasAdmin = empSignalView.activePeers.some((p) => String(p.userId) === adminId);
    assert(hasAdmin, "Employee sees Admin in active peers list");

    // 6. WebRTC Signaling Relay (Offer -> DB -> Answer -> DB -> ICE Candidate)
    console.log("\n--- 6. WebRTC Audio/Video Track Signaling via MongoDB ---");
    // Admin sends SDP offer to Employee
    const mockOfferSdp = { type: "offer", sdp: "v=0\r\no=admin 1234 1 IN IP4 127.0.0.1\r\nm=audio 5004 UDP/TLS/RTP/SAVPF 111\r\nm=video 5006 UDP/TLS/RTP/SAVPF 96" };
    const resSendOffer = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetUserId: employeeId,
        type: "offer",
        signal: mockOfferSdp,
      }),
    });
    assert(resSendOffer.status === 200, "Admin dispatched SDP offer targeting Employee");

    // Employee retrieves queued signals from DB
    const resEmpSignalsReceived = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const empReceivedData = await resEmpSignalsReceived.json();
    assert(empReceivedData.signals.length === 1, "Employee retrieved queued SDP offer from database");
    assert(empReceivedData.signals[0].type === "offer", "Signal verified as WebRTC offer");
    assert(empReceivedData.signals[0].senderId === adminId, "Offer sender attributed to Admin");

    // Employee sends SDP answer to Admin
    const mockAnswerSdp = { type: "answer", sdp: "v=0\r\no=emp 5678 1 IN IP4 127.0.0.1\r\nm=audio 5004 UDP/TLS/RTP/SAVPF 111\r\nm=video 5006 UDP/TLS/RTP/SAVPF 96" };
    const resSendAnswer = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({
        targetUserId: adminId,
        type: "answer",
        signal: mockAnswerSdp,
      }),
    });
    assert(resSendAnswer.status === 200, "Employee dispatched SDP answer targeting Admin");

    // Admin retrieves queued answer from DB
    const resAdminSignalsReceived = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminReceivedData = await resAdminSignalsReceived.json();
    assert(adminReceivedData.signals.length === 1, "Admin retrieved queued SDP answer from database");
    assert(adminReceivedData.signals[0].type === "answer", "Signal verified as WebRTC answer");

    // ICE Candidate relay
    const mockCandidate = { candidate: "candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetUserId: employeeId,
        type: "candidate",
        signal: mockCandidate,
      }),
    });
    const resEmpCandidateReceived = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const empCandData = await resEmpCandidateReceived.json();
    assert(empCandData.signals.length === 1 && empCandData.signals[0].type === "candidate", "ICE candidate successfully relayed via MongoDB");

    // 7. Camera & Microphone Toggle State Sync
    console.log("\n--- 7. Camera & Mic State Synchronization ---");
    // Admin toggles camera off, mic on
    await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/peer-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ cameraOn: false, micOn: true }),
    });

    const resCheckState = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const stateData = await resCheckState.json();
    const adminPeer = stateData.activePeers.find((p) => String(p.userId) === adminId);
    assert(adminPeer && adminPeer.cameraOn === false, "Employee observes Admin camera turned OFF");
    assert(adminPeer && adminPeer.micOn === true, "Employee observes Admin mic turned ON");

    // 8. Screen Sharing: Admin shares, then Employee shares
    console.log("\n--- 8. Screen Sharing State Synchronization ---");
    // Admin shares screen
    await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/peer-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ screenSharing: true }),
    });
    const resEmpSeesAdminScreen = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const empScreenCheck = await resEmpSeesAdminScreen.json();
    const adminPeerScreen = empScreenCheck.activePeers.find((p) => String(p.userId) === adminId);
    assert(adminPeerScreen && adminPeerScreen.screenSharing === true, "Employee observes Admin sharing screen (presentation mode)");

    // Admin stops sharing, Employee starts sharing
    await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/peer-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ screenSharing: false }),
    });
    await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/peer-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({ screenSharing: true }),
    });
    const resAdminSeesEmpScreen = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminScreenCheck = await resAdminSeesEmpScreen.json();
    const empPeerScreen = adminScreenCheck.activePeers.find((p) => String(p.userId) === employeeId);
    assert(empPeerScreen && empPeerScreen.screenSharing === true, "Admin observes Employee sharing screen (presentation mode)");

    // 9. Two-Way In-Call Chat
    console.log("\n--- 9. Two-Way In-Call Chat ---");
    // Admin sends message
    const resAdminMsg = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ text: "Hello John, can you review the sprint backlog?" }),
    });
    assert(resAdminMsg.status === 201, "Admin posted chat message");

    // Employee sends reply
    const resEmpMsg = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({ text: "Yes Sarah, reviewing the task hierarchy now." }),
    });
    assert(resEmpMsg.status === 201, "Employee posted reply chat message");

    // Verify both messages retrieved in room chat history
    const resChatHistory = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/chat`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const chatList = await resChatHistory.json();
    assert(chatList.length >= 2, "Both chat messages retrieved in conversation history");
    assert(chatList[chatList.length - 2].text.includes("sprint backlog"), "Admin message verified");
    assert(chatList[chatList.length - 1].text.includes("task hierarchy"), "Employee reply verified");

    // 10. Meeting Controls: Host Mute & Lock Meeting
    console.log("\n--- 10. Meeting Controls (Host Mute & Lock) ---");
    // Host locks room
    const resLock = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/host-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: "lockMeeting", value: true }),
    });
    const lockResult = await resLock.json();
    assert(lockResult.hostControls.lockMeeting === true, "Admin locked meeting room");

    // Host Mute All
    const resMuteAll = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/host-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: "muteAll", value: true }),
    });
    const muteResult = await resMuteAll.json();
    assert(muteResult.hostControls.muteAll === true, "Admin triggered Mute All");
    assert(muteResult.hostControls.muteAllTimestamp > 0, "Mute All timestamp generated for event triggering");

    // 11. Leave & Reconnect
    console.log("\n--- 11. Leave & Reconnect Flow ---");
    // Employee leaves
    const resEmpLeave = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert(resEmpLeave.status === 200, "Employee left meeting room");

    // Admin checks peers (should only see self)
    const resAfterLeave = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterLeaveData = await resAfterLeave.json();
    assert(afterLeaveData.activePeers.length === 1, "Active peers correctly reduced to 1 after employee leaves");

    // Employee reconnects
    const resEmpRejoin = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert(resEmpRejoin.status === 200, "Employee re-joined meeting room");

    const resAfterRejoin = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterRejoinData = await resAfterRejoin.json();
    assert(afterRejoinData.activePeers.length === 2, "Active peers correctly restored to 2 after reconnect");

    // 12. Host Ends Meeting For Everyone
    console.log("\n--- 12. Host Ends Meeting For Everyone ---");
    const resEndMeeting = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resEndMeeting.status === 200, "Host ended meeting for all participants");

    // Employee checks signals: receives meetingStatus: completed
    const resEmpMeetingEndedCheck = await fetch(`${BASE_URL}/meetings/rooms/${roomCode}/signals`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const empEndCheckData = await resEmpMeetingEndedCheck.json();
    assert(empEndCheckData.meetingStatus === "completed", "Employee notified of completed meeting status via signals");

    console.log("\n=================================================");
    console.log(`ALL PHASE 6 PRODUCTION TESTS PASSED! (${passed}/${total})`);
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ PHASE 6 TEST FAILURE:", err);
    process.exit(1);
  } finally {
    await server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runProductionE2ETests();
