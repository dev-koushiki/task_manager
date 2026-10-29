const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const User = require("./models/User");
const Organization = require("./models/Organization");
const Invitation = require("./models/Invitation");
const Task = require("./models/Task");
const Meeting = require("./models/Meeting");
const Notification = require("./models/Notification");

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function runTest() {
  console.log("=================================================");
  console.log("TESTING CALENDAR, MEETINGS & DEPT INVITATIONS");
  console.log("=================================================\n");

  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager";
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("Connected to MongoDB successfully.\n");

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/organization", organizationRoutes);
  app.use("/api/meetings", meetingRoutes);
  app.use("/api/notifications", notificationRoutes);

  const TEST_PORT = 5199;
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
    const adminEmail = `admin_${timestamp}@workspaces.com`;
    const employeeEmail = `emp_${timestamp}@workspaces.com`;

    // 1. Register Admin & Workspace
    console.log("--- 1. Register Workspace Admin ---");
    const resReg = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Alex",
        lastName: "Johnson",
        email: adminEmail,
        password: "Password123!",
        companyName: `Workspace Corp ${timestamp}`,
        designation: "Executive Lead",
      }),
    });
    const regData = await resReg.json();
    assert(resReg.status === 201, "Admin registered successfully");
    const adminToken = regData.token;
    const orgId = regData.user.organizationId;
    assert(orgId !== undefined && orgId !== null, "Admin organization created");

    // 2. Department-based Employee Invitation
    console.log("\n--- 2. Department-Based Employee Invitation ---");
    const resInvite = await fetch(`${BASE_URL}/admin/employees/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Sarah Miller",
        email: employeeEmail,
        department: "Engineering & Technology",
        role: "employee",
        positionTitle: "Senior Frontend Engineer",
      }),
    });
    const inviteData = await resInvite.json();
    assert(resInvite.status === 201, "Department invitation generated");
    assert(inviteData.invitation.department === "Engineering & Technology", "Invitation associated with selected department");
    assert(inviteData.invitation.status === "pending", "Invitation status is pending");
    assert(inviteData.inviteToken !== undefined, "Invite raw token returned");
    const invitationId = inviteData.invitation.id || inviteData.invitation._id;

    // 3. Resend Invitation
    console.log("\n--- 3. Resend Invitation ---");
    const resResend = await fetch(`${BASE_URL}/admin/invitations/${invitationId}/resend`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const resendData = await resResend.json();
    assert(resResend.status === 200, "Invitation resent successfully");
    assert(resendData.inviteToken !== undefined, "Fresh single-use inviteToken generated");
    assert(resendData.invitation.status === "pending", "Status reset to pending");

    // 4. Revoke Invitation
    console.log("\n--- 4. Revoke Invitation ---");
    const resRevoke = await fetch(`${BASE_URL}/admin/invitations/${invitationId}/revoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const revokeData = await resRevoke.json();
    assert(resRevoke.status === 200, "Invitation revoked successfully");
    assert(revokeData.invitation.status === "revoked", "Status updated to revoked");

    // 5. Re-activate & Accept Invitation -> Assign to Department
    console.log("\n--- 5. Reactivate & Accept Invitation ---");
    const resReactivate = await fetch(`${BASE_URL}/admin/invitations/${invitationId}/resend`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const reactivateData = await resReactivate.json();
    const finalToken = reactivateData.inviteToken;

    const resAccept = await fetch(`${BASE_URL}/auth/register/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken: finalToken,
        password: "Password123!",
      }),
    });
    const acceptData = await resAccept.json();
    assert(resAccept.status === 201, "Invitation accepted and account activated");
    const empUser = await User.findOne({ email: employeeEmail });
    assert(empUser !== null, "Employee record created in DB");
    assert(empUser.department === "Engineering & Technology", "Employee correctly assigned to invitation's department");
    const employeeToken = acceptData.token;
    const employeeId = empUser._id.toString();

    // 6. Schedule Meeting & Availability Conflict Warning
    console.log("\n--- 6. Schedule Meeting & Availability Conflict Warning ---");
    const todayStr = "2026-11-05";
    const resMtg1 = await fetch(`${BASE_URL}/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Sprint Review & Planning",
        agenda: "Review roadmap and assign story points",
        date: todayStr,
        startTime: "10:00",
        endTime: "11:00",
        location: "Conference Room B",
        participants: [
          {
            userId: employeeId,
            name: "Sarah Miller",
            email: employeeEmail,
          },
        ],
      }),
    });
    const mtg1Data = await resMtg1.json();
    assert(resMtg1.status === 201, "Meeting scheduled successfully");
    const meeting1Id = mtg1Data.meeting._id;

    // Check employee received notification
    const resEmpNotifs = await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const empNotifsData = await resEmpNotifs.json();
    assert(empNotifsData.unreadCount >= 1, "Employee received meeting invite notification");
    assert(empNotifsData.notifications.some((n) => n.type === "meeting_invite"), "Notification type is 'meeting_invite'");

    // Check conflict warning when scheduling overlapping meeting
    const resConflict = await fetch(
      `${BASE_URL}/meetings/conflicts?date=${todayStr}&startTime=10:30&endTime=11:30&participantIds=${employeeId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const conflictData = await resConflict.json();
    assert(conflictData.hasConflict === true, "Scheduling conflict accurately detected");
    assert(conflictData.conflicts.length > 0, "Conflict details returned");
    assert(conflictData.conflicts[0].meetingTitle === "Sprint Review & Planning", "Conflicting meeting identified");

    // 7. Participant RSVP (Accept / Tentative / Decline)
    console.log("\n--- 7. Participant RSVP ---");
    const resRSVP = await fetch(`${BASE_URL}/meetings/${meeting1Id}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    const rsvpData = await resRSVP.json();
    assert(resRSVP.status === 200, "RSVP response recorded");
    const updatedPart = rsvpData.meeting.participants.find((p) => p.userId.toString() === employeeId);
    assert(updatedPart.status === "accepted", "Participant status updated to 'accepted'");

    // 8. Meeting Minutes & Action Items
    console.log("\n--- 8. Meeting Minutes & Action Items ---");
    const resMinutes = await fetch(`${BASE_URL}/meetings/${meeting1Id}/minutes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        notes: "Discussed architecture revamp and team alignment.",
        decisions: ["Adopted Tailwind and React 19 standards", "Sprint 4 delivery confirmed"],
        actionItems: [
          {
            description: "Implement Responsive Kanban Board",
            assigneeId: employeeId,
            assigneeName: "Sarah Miller",
            dueDate: "2026-11-10",
          },
        ],
      }),
    });
    const minData = await resMinutes.json();
    assert(resMinutes.status === 200, "Meeting minutes and action items saved");
    assert(minData.meeting.status === "completed", "Meeting status updated to completed");
    assert(minData.meeting.minutes.actionItems.length === 1, "Action item recorded in minutes");
    const actionItemId = minData.meeting.minutes.actionItems[0]._id;

    // 9. Convert Action Item to System Task
    console.log("\n--- 9. Convert Meeting Action Item to System Task ---");
    const resConvert = await fetch(`${BASE_URL}/meetings/${meeting1Id}/action-items/${actionItemId}/convert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const convertData = await resConvert.json();
    if (resConvert.status !== 201) console.error("Convert response:", resConvert.status, convertData);
    assert(resConvert.status === 201, "Action item converted into system Task");
    assert(convertData.task.title === "Implement Responsive Kanban Board", "Task title matches action item");
    assert(convertData.task.assignedTo.toString() === employeeId, "Task assigned to action item owner");
    assert(convertData.meeting.minutes.actionItems[0].status === "converted", "Action item status marked as converted");

    // Check Task exists in Task collection
    const createdTask = await Task.findById(convertData.task._id);
    assert(createdTask !== null, "Converted task exists in DB Tasks collection");

    // 10. Meeting Cancellation
    console.log("\n--- 10. Meeting Cancellation ---");
    const resMtg2 = await fetch(`${BASE_URL}/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Ad-hoc Sync",
        date: todayStr,
        startTime: "15:00",
        endTime: "15:30",
        participants: [{ userId: employeeId, name: "Sarah Miller", email: employeeEmail }],
      }),
    });
    const mtg2 = (await resMtg2.json()).meeting;

    const resCancel = await fetch(`${BASE_URL}/meetings/${mtg2._id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: "Postponed due to client workshop" }),
    });
    const cancelData = await resCancel.json();
    assert(resCancel.status === 200, "Meeting cancelled successfully");
    assert(cancelData.meeting.status === "cancelled", "Meeting status marked as cancelled");
    assert(cancelData.meeting.cancellationReason === "Postponed due to client workshop", "Cancellation reason recorded");

    console.log("\n=================================================");
    console.log(`ALL TESTS PASSED! (${passed}/${total})`);
    console.log("=================================================");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exitCode = 1;
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTest();
