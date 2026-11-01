const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const groupRoutes = require("./routes/groupRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const Group = require("./models/Group");
const Message = require("./models/Message");
const Notification = require("./models/Notification");

async function runPhase3GroupingTests() {
  console.log("=================================================");
  console.log("PHASE 3: GROUPING AND INVITES SYSTEM TEST");
  console.log("=================================================\n");

  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager";
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log("Connected to MongoDB successfully.\n");

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/groups", groupRoutes);
  app.use("/api/notifications", notificationRoutes);

  const TEST_PORT = 5203;
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
    const adminEmail = `admin_${timestamp}@grouptest.com`;
    const emp1Email = `bob_${timestamp}@grouptest.com`;
    const emp2Email = `charlie_${timestamp}@grouptest.com`;
    const emp3Email = `dave_${timestamp}@grouptest.com`;

    // 1. Setup Admin and Employees
    console.log("--- 1. Register Admin & Onboard Employees ---");
    const resAdmin = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Alice",
        lastName: "Director",
        email: adminEmail,
        password: "Password123!",
        companyName: `Grouping Innovations ${timestamp}`,
        designation: "Managing Director",
      }),
    });
    const adminData = await resAdmin.json();
    assert(resAdmin.status === 201, "Admin registered successfully");
    const adminToken = adminData.token;
    const adminId = String(adminData.user.id || adminData.user._id);

    // Invite Bob & Charlie
    const inviteEmp = async (name, email) => {
      const resInv = await fetch(`${BASE_URL}/admin/employees/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name,
          email,
          department: "Engineering & Technology",
          role: "employee",
        }),
      });
      const invData = await resInv.json();
      const resAcc = await fetch(`${BASE_URL}/auth/register/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: invData.inviteToken,
          password: "Password123!",
        }),
      });
      const accData = await resAcc.json();
      return { token: accData.token, id: String(accData.user.id || accData.user._id) };
    };

    const bob = await inviteEmp("Bob Engineer", emp1Email);
    assert(Boolean(bob.token), "Bob onboarded to organization");

    const charlie = await inviteEmp("Charlie Specialist", emp2Email);
    assert(Boolean(charlie.token), "Charlie onboarded to organization");

    // 2. Fetch Group List (Initially Empty)
    console.log("\n--- 2. Initial Groups Query ---");
    const resInitialGroups = await fetch(`${BASE_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const initialGroups = await resInitialGroups.json();
    assert(resInitialGroups.status === 200, "Queried groups endpoint successfully");
    assert(Array.isArray(initialGroups) && initialGroups.length === 0, "No groups exist initially");

    // 3. Create Group with Selected Employees
    console.log("\n--- 3. Create Group from Selected Employees ---");
    const resCreateGroup = await fetch(`${BASE_URL}/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Sprint Alpha Working Group",
        description: "Core cross-functional project group for release",
        memberIds: [bob.id, charlie.id],
      }),
    });
    const createData = await resCreateGroup.json();
    assert(resCreateGroup.status === 201, "Group created successfully");
    assert(createData.group && createData.group.name === "Sprint Alpha Working Group", "Group name matches input");
    assert(createData.group.members.length === 3, "Group contains 3 members (Creator + Bob + Charlie)");
    const groupId = createData.group._id;

    // Check creator role is admin
    const adminMember = createData.group.members.find((m) => String(m.userId) === adminId);
    assert(adminMember && adminMember.role === "admin", "Creator is group admin");

    // 4. Verify Notifications dispatched to Bob & Charlie
    console.log("\n--- 4. Verify Notifications Dispatched ---");
    const resBobNotifs = await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    const bobNotifData = await resBobNotifs.json();
    const groupNotif = (bobNotifData.notifications || []).find((n) => n.type === "group_added");
    assert(Boolean(groupNotif), "Bob received 'group_added' notification");
    assert(groupNotif && groupNotif.message.includes("Sprint Alpha Working Group"), "Notification links to correct group name");

    // 5. Edit Group Name and Details
    console.log("\n--- 5. Edit Group Name and Details ---");
    const resEditGroup = await fetch(`${BASE_URL}/groups/${groupId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Sprint Alpha Core Squad",
        description: "Updated description: High priority squad",
      }),
    });
    const editData = await resEditGroup.json();
    assert(resEditGroup.status === 200, "Group details updated successfully");
    assert(editData.group.name === "Sprint Alpha Core Squad", "Group name updated in database");
    assert(editData.group.description.includes("High priority squad"), "Group description updated in database");

    // 6. Display Group Details & Members
    console.log("\n--- 6. Query Group Details & Members ---");
    const resGetGroup = await fetch(`${BASE_URL}/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    const getGroupData = await resGetGroup.json();
    assert(resGetGroup.status === 200, "Member can query group details");
    assert(getGroupData.members.length === 3, "All 3 members displayed in group details");

    // 7. Add Member to Group
    console.log("\n--- 7. Add New Member to Group ---");
    const dave = await inviteEmp("Dave Tech", emp3Email);
    const resAddMember = await fetch(`${BASE_URL}/groups/${groupId}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ memberIds: [dave.id] }),
    });
    const addMemberData = await resAddMember.json();
    assert(resAddMember.status === 200, "Dave added to group successfully");
    assert(addMemberData.group.members.length === 4, "Group member count incremented to 4");

    // 8. Remove Member from Group
    console.log("\n--- 8. Remove Member from Group ---");
    const resRemoveMember = await fetch(`${BASE_URL}/groups/${groupId}/members/${dave.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const removeMemberData = await resRemoveMember.json();
    assert(resRemoveMember.status === 200, "Dave removed from group successfully");
    assert(removeMemberData.group.members.length === 3, "Group member count reduced back to 3");

    // 9. Send Group Messages & Message Replies
    console.log("\n--- 9. Group Chat with Replies & Timestamps ---");
    // Alice sends initial message
    const resSend1 = await fetch(`${BASE_URL}/groups/${groupId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ text: "Welcome to the new Sprint Alpha squad!" }),
    });
    const send1Data = await resSend1.json();
    assert(resSend1.status === 201, "Alice posted message to group");
    const message1 = send1Data.chatMessage;
    assert(Boolean(message1.createdAt), "Message has timestamp");

    // Bob replies to Alice's message
    const resSendReply = await fetch(`${BASE_URL}/groups/${groupId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bob.token}`,
      },
      body: JSON.stringify({
        text: "Thanks Alice! Ready to tackle the milestones.",
        replyTo: {
          messageId: message1._id,
          senderName: message1.senderName,
          text: message1.text,
        },
      }),
    });
    const sendReplyData = await resSendReply.json();
    assert(resSendReply.status === 201, "Bob posted reply to Alice's message");
    const replyMsg = sendReplyData.chatMessage;
    assert(replyMsg.replyTo && replyMsg.replyTo.senderName === "Alice Director", "Reply preserves sender name");
    assert(replyMsg.replyTo.text.includes("Sprint Alpha squad"), "Reply preserves original message quote snippet");

    // 10. Query Message History
    console.log("\n--- 10. Query Message History ---");
    const resHistory = await fetch(`${BASE_URL}/groups/${groupId}/messages`, {
      headers: { Authorization: `Bearer ${charlie.token}` },
    });
    const historyData = await resHistory.json();
    assert(resHistory.status === 200, "Charlie retrieved group message history");
    assert(historyData.length === 2, "Message history contains exactly 2 messages");
    assert(historyData[1].replyTo !== null, "Second message correctly includes reply quote in history");

    // 11. Support 1-on-1 Direct Chats
    console.log("\n--- 11. Support 1-on-1 Direct Individual Chat ---");
    // Alice starts direct chat with Bob
    const resDirectChat = await fetch(`${BASE_URL}/groups/direct/${bob.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const directData = await resDirectChat.json();
    assert(resDirectChat.status === 200, "Alice initiated direct 1-on-1 chat with Bob");
    assert(directData.group && directData.group.isDirectChat === true, "Conversation marked as direct chat");
    const directChatId = directData.group._id;

    // Alice sends direct message to Bob
    const resDirectMsg = await fetch(`${BASE_URL}/groups/${directChatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ text: "Hey Bob, can you review the sprint backlog privately?" }),
    });
    assert(resDirectMsg.status === 201, "Alice sent direct message to Bob");

    // Bob queries his groups (should see direct chat with Alice)
    const resBobGroups = await fetch(`${BASE_URL}/groups`, {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    const bobGroupsList = await resBobGroups.json();
    const bobDirectConversation = bobGroupsList.find((g) => g._id === directChatId);
    assert(Boolean(bobDirectConversation), "Bob sees the direct conversation in his chat list");
    assert(bobDirectConversation.displayName === "Alice Director", "Direct conversation title displays colleague name");
    assert(bobDirectConversation.lastMessage.text.includes("sprint backlog"), "Last message preview matches sent direct message");

    // Bob replies in direct chat
    const resBobReplyDirect = await fetch(`${BASE_URL}/groups/${directChatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bob.token}`,
      },
      body: JSON.stringify({ text: "Sure thing Alice, checking now." }),
    });
    assert(resBobReplyDirect.status === 201, "Bob replied in direct chat");

    console.log("\n=================================================");
    console.log(`ALL PHASE 3 GROUPING TESTS PASSED! (${passed}/${total})`);
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ PHASE 3 TEST FAILURE:", err);
    process.exit(1);
  } finally {
    await server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runPhase3GroupingTests();
