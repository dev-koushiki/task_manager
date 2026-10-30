const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: "./backend/.env" });
require("dotenv").config();

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
const Task = require("./models/Task");
const TaskUpdate = require("./models/TaskUpdate");
const Notification = require("./models/Notification");
const Invitation = require("./models/Invitation");

async function postJson(url, body, token = null) {
  const parsed = new URL(url);
  const data = JSON.stringify(body || {});
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + (parsed.search || ""),
        method: "POST",
        headers,
      },
      (res) => {
        let respBody = "";
        res.on("data", (chunk) => (respBody += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respBody) });
          } catch {
            resolve({ status: res.statusCode, data: respBody });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getJson(url, token = null) {
  const parsed = new URL(url);
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + (parsed.search || ""),
        method: "GET",
        headers,
      },
      (res) => {
        let respBody = "";
        res.on("data", (chunk) => (respBody += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respBody) });
          } catch {
            resolve({ status: res.statusCode, data: respBody });
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function patchJson(url, body, token = null) {
  const parsed = new URL(url);
  const data = JSON.stringify(body || {});
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + (parsed.search || ""),
        method: "PATCH",
        headers,
      },
      (res) => {
        let respBody = "";
        res.on("data", (chunk) => (respBody += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respBody) });
          } catch {
            resolve({ status: res.statusCode, data: respBody });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function deleteJson(url, token = null) {
  const parsed = new URL(url);
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + (parsed.search || ""),
        method: "DELETE",
        headers,
      },
      (res) => {
        let respBody = "";
        res.on("data", (chunk) => (respBody += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respBody) });
          } catch {
            resolve({ status: res.statusCode, data: respBody });
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING ORGANIZATIONAL TREE & TASK SYSTEM VERIFICATION");
  console.log("=================================================\n");

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required to run test suite.");
  }

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

  const PORT = 5188;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  const BASE = `http://localhost:${PORT}/api`;
  console.log(`Test API Server running on ${BASE}\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
    }
  }

  try {
    const timestamp = Date.now();
    const companyName = `AcmeTree_${timestamp}`;

    // =========================================================
    // TEST 1: Default tree creation for a new organization
    // =========================================================
    console.log("--- TEST 1: Default Tree Creation for New Organization ---");
    const adminRegRes = await postJson(`${BASE}/auth/register`, {
      firstName: "Alice",
      lastName: "Admin",
      email: `alice_${timestamp}@acmetree.com`,
      password: "password123",
      companyName,
      designation: "Chief Executive Officer",
    });

    assert(adminRegRes.status === 201, "Admin registers successfully");
    const adminToken = adminRegRes.data.token;
    const adminUser = adminRegRes.data.user;
    assert(adminUser.employeeId === "EMP-001", "Admin assigned employee ID EMP-001");

    const treeRes = await getJson(`${BASE}/organization/tree`, adminToken);
    assert(treeRes.status === 200, "Fetched organization tree successfully");
    const nodes = treeRes.data.treeNodes || [];
    assert(nodes.length === 5, `Default tree has 5 nodes (Root A, B, C, D, E). Found: ${nodes.length}`);

    const rootNode = nodes.find((n) => n.id === "node_root");
    const nodeB = nodes.find((n) => n.id === "node_b");
    const nodeC = nodes.find((n) => n.id === "node_c");
    const nodeD = nodes.find((n) => n.id === "node_d");
    const nodeE = nodes.find((n) => n.id === "node_e");

    assert(rootNode && rootNode.parentId === null, "Root node A has parentId: null");
    assert(rootNode && rootNode.employeeId === adminUser.id, "Main Admin Alice occupies root node A");
    assert(nodeB && nodeB.parentId === "node_root", "Node B parent is Root A");
    assert(nodeC && nodeC.parentId === "node_root", "Node C parent is Root A");
    assert(nodeD && nodeD.parentId === "node_c", "Node D parent is Node C");
    assert(nodeE && nodeE.parentId === "node_c", "Node E parent is Node C");

    // =========================================================
    // TEST 2: Adding, deleting, moving, and reorganizing tree nodes
    // =========================================================
    console.log("\n--- TEST 2: Adding, Deleting, Moving, and Reorganizing Nodes ---");
    // Add Node F under Node C
    const addNodeRes = await postJson(
      `${BASE}/organization/tree/nodes`,
      { title: "Specialist F", parentId: "node_c", department: "Engineering" },
      adminToken
    );
    assert(addNodeRes.status === 201, "Added new node F under Node C");
    const nodeF = addNodeRes.data.node;

    // Move Node F under Node B
    const moveRes = await postJson(
      `${BASE}/organization/tree/move`,
      { nodeId: nodeF.id, newParentId: "node_b" },
      adminToken
    );
    assert(moveRes.status === 200, "Moved node F from Node C to Node B");

    // Delete Node F
    const deleteRes = await deleteJson(`${BASE}/organization/tree/nodes/${nodeF.id}`, adminToken);
    assert(deleteRes.status === 200, "Deleted node F successfully");

    // Merge Node E into Node D
    const mergeRes = await postJson(
      `${BASE}/organization/tree/merge`,
      { sourceNodeId: "node_e", targetNodeId: "node_d" },
      adminToken
    );
    assert(mergeRes.status === 200, "Merged node E into node D successfully");

    // =========================================================
    // TEST 3 & 4: Employee activation, Active Profiles & Employee ID
    // =========================================================
    console.log("\n--- TEST 3 & 4: Employee Activation, Active Profiles & Employee ID Assignment ---");
    // Invite Bob (Manager), Charlie (Tech Lead), Dave (Intern/Engineer)
    const inviteBob = await postJson(
      `${BASE}/admin/employees/invite`,
      {
        name: "Bob Manager",
        email: `bob_${timestamp}@acmetree.com`,
        department: "Operations",
        role: "manager",
        permissions: { canAssignTasks: true, canCreateTasks: true },
      },
      adminToken
    );
    assert(inviteBob.status === 201, "Invited Bob Manager");
    const bobToken = inviteBob.data.inviteToken;

    const inviteCharlie = await postJson(
      `${BASE}/admin/employees/invite`,
      {
        name: "Charlie Lead",
        email: `charlie_${timestamp}@acmetree.com`,
        department: "Engineering",
        role: "manager",
        permissions: { canAssignTasks: true, canCreateTasks: true },
      },
      adminToken
    );
    assert(inviteCharlie.status === 201, "Invited Charlie Lead");
    const charlieToken = inviteCharlie.data.inviteToken;

    const inviteDave = await postJson(
      `${BASE}/admin/employees/invite`,
      {
        name: "Dave Engineer",
        email: `dave_${timestamp}@acmetree.com`,
        department: "Engineering",
        role: "employee",
        permissions: { canAssignTasks: false, canCreateTasks: false },
      },
      adminToken
    );
    assert(inviteDave.status === 201, "Invited Dave Engineer (Intern/Fresher with NO assign permission)");
    const daveToken = inviteDave.data.inviteToken;

    // Activate Bob
    const actBob = await postJson(`${BASE}/auth/register/accept-invite`, {
      inviteToken: bobToken,
      password: "password123",
      confirmPassword: "password123",
    });
    assert(actBob.status === 201, "Bob activated his account successfully");
    const bobUser = actBob.data.user;

    // Activate Charlie
    const actCharlie = await postJson(`${BASE}/auth/register/accept-invite`, {
      inviteToken: charlieToken,
      password: "password123",
      confirmPassword: "password123",
    });
    assert(actCharlie.status === 201, "Charlie activated his account successfully");
    const charlieUser = actCharlie.data.user;

    // Activate Dave
    const actDave = await postJson(`${BASE}/auth/register/accept-invite`, {
      inviteToken: daveToken,
      password: "password123",
      confirmPassword: "password123",
    });
    assert(actDave.status === 201, "Dave activated his account successfully");
    const daveUser = actDave.data.user;

    // Check Active Profiles list in tree response
    const treeWithProfiles = await getJson(`${BASE}/organization/tree`, adminToken);
    const activeProfiles = treeWithProfiles.data.activeEmployees || [];
    assert(activeProfiles.length >= 4, `Active profiles includes Alice, Bob, Charlie, Dave (${activeProfiles.length})`);
    const bobProfile = activeProfiles.find((p) => p.email === bobUser.email);
    assert(bobProfile && !bobProfile.isAssigned, "Bob is active and initially unassigned in tree");

    // =========================================================
    // TEST 5: Employee-to-node mapping & Employee ID assignment
    // =========================================================
    console.log("\n--- TEST 5: Employee-to-Node Mapping & Duplicate Assignment Prevention ---");
    // Assign Bob to node_b with EMP-002
    const assignBobRes = await postJson(
      `${BASE}/organization/tree/nodes/node_b/assign`,
      { userId: bobUser.id, employeeCode: "EMP-002" },
      adminToken
    );
    assert(assignBobRes.status === 200, "Mapped Bob to Node B with Employee ID EMP-002");

    // Assign Charlie to node_c with EMP-003
    const assignCharlieRes = await postJson(
      `${BASE}/organization/tree/nodes/node_c/assign`,
      { userId: charlieUser.id, employeeCode: "EMP-003" },
      adminToken
    );
    assert(assignCharlieRes.status === 200, "Mapped Charlie to Node C with Employee ID EMP-003");

    // Assign Dave to node_d with EMP-004
    const assignDaveRes = await postJson(
      `${BASE}/organization/tree/nodes/node_d/assign`,
      { userId: daveUser.id, employeeCode: "EMP-004" },
      adminToken
    );
    assert(assignDaveRes.status === 200, "Mapped Dave to Node D with Employee ID EMP-004");

    // Duplicate Prevention Check: Map Dave to node_b (should unassign Dave from node_d)
    const duplicateMapRes = await postJson(
      `${BASE}/organization/tree/nodes/node_b/assign`,
      { userId: daveUser.id, employeeCode: "EMP-004" },
      adminToken
    );
    assert(duplicateMapRes.status === 200, "Re-assigning Dave to Node B succeeded");
    const treeCheckDup = await getJson(`${BASE}/organization/tree`, adminToken);
    const nodeDAfter = treeCheckDup.data.treeNodes.find((n) => n.id === "node_d");
    assert(!nodeDAfter.employeeId, "Dave was automatically unassigned from Node D (duplicate assignment prevented)");

    // Put Bob back on node_b and Dave back on node_d
    await postJson(`${BASE}/organization/tree/nodes/node_b/assign`, { userId: bobUser.id, employeeCode: "EMP-002" }, adminToken);
    await postJson(`${BASE}/organization/tree/nodes/node_d/assign`, { userId: daveUser.id, employeeCode: "EMP-004" }, adminToken);

    // =========================================================
    // TEST 6: Dynamic reporting relationships from tree
    // =========================================================
    console.log("\n--- TEST 6: Dynamic Reporting Relationships Verification ---");
    // Bob is on Node B (child of Root Alice) -> Bob reports to Alice
    // Charlie is on Node C (child of Root Alice) -> Charlie reports to Alice
    // Dave is on Node D (child of Node C Charlie) -> Dave reports to Charlie
    const bobDb = await User.findById(bobUser.id);
    const charlieDb = await User.findById(charlieUser.id);
    const daveDb = await User.findById(daveUser.id);

    assert(bobDb.reportsTo?.toString() === adminUser.id.toString(), "Bob dynamically reports to Alice Admin");
    assert(charlieDb.reportsTo?.toString() === adminUser.id.toString(), "Charlie dynamically reports to Alice Admin");
    assert(daveDb.reportsTo?.toString() === charlieUser.id.toString(), "Dave dynamically reports to Charlie Lead");

    // =========================================================
    // TEST 7: Unified Employee Dashboard Endpoints
    // =========================================================
    console.log("\n--- TEST 7: Unified Employee Dashboard Accessibility ---");
    const charlieLogin = await postJson(`${BASE}/auth/login`, {
      email: charlieUser.email,
      password: "password123",
    });
    const charlieAuthToken = charlieLogin.data.token;
    assert(charlieLogin.status === 200, "Charlie logged into Unified Dashboard");

    const daveLogin = await postJson(`${BASE}/auth/login`, {
      email: daveUser.email,
      password: "password123",
    });
    const daveAuthToken = daveLogin.data.token;
    assert(daveLogin.status === 200, "Dave logged into Unified Dashboard");

    // =========================================================
    // TEST 8: Assignment Panel Permission Handling
    // =========================================================
    console.log("\n--- TEST 8: Assignment Panel Permission Validation ---");
    // Charlie has assignment permission -> Authorized assignees returns Dave
    const charlieAssigneesRes = await getJson(`${BASE}/tasks/authorized-assignees`, charlieAuthToken);
    assert(charlieAssigneesRes.status === 200, "Charlie retrieved authorized assignees list");
    const charlieAssignees = charlieAssigneesRes.data || [];
    assert(
      charlieAssignees.some((a) => (a._id || a.id) === daveUser.id),
      "Charlie is authorized to assign tasks to Dave (reporting subordinate in tree)"
    );

    // Dave has NO assignment permission -> Authorized assignees returns empty
    const daveAssigneesRes = await getJson(`${BASE}/tasks/authorized-assignees`, daveAuthToken);
    assert(daveAssigneesRes.status === 200 && daveAssigneesRes.data.length === 0, "Dave (fresher/intern) has 0 authorized assignees (restricted)");

    // Dave attempts unauthorized task assignment -> Backend rejects with 403
    const daveUnauthorizedAssign = await postJson(
      `${BASE}/tasks`,
      {
        title: "Dave attempts to delegate task",
        assignedTo: charlieUser.id,
      },
      daveAuthToken
    );
    assert(daveUnauthorizedAssign.status === 403, "Backend rejected unauthorized task assignment from Dave (403 Forbidden)");

    // Charlie tries to assign to Bob (Bob is NOT in Charlie's reporting line) -> Backend rejects
    const charlieCrossAssign = await postJson(
      `${BASE}/tasks`,
      {
        title: "Cross branch unauthorized assignment",
        assignedTo: bobUser.id,
      },
      charlieAuthToken
    );
    assert(charlieCrossAssign.status === 403, "Backend rejected cross-branch assignment from Charlie to Bob (403 Forbidden)");

    // =========================================================
    // TEST 9 & 10: Task Assignment, Submission & Reporting Supervisor
    // =========================================================
    console.log("\n--- TEST 9 & 10: Task Assignment, Submission & Reporting Workflow ---");
    // Charlie assigns task to Dave with milestones
    const charlieAssignTaskRes = await postJson(
      `${BASE}/tasks`,
      {
        title: "Implement Core Data Parser",
        description: "Parse CSV and JSON streams efficiently",
        assignedTo: daveUser.id,
        deadline: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        milestones: [
          { title: "Define Interface Schema" },
          { title: "Implement Parser Engine" },
          { title: "Run Stress Benchmarks" },
        ],
      },
      charlieAuthToken
    );
    assert(charlieAssignTaskRes.status === 201, "Charlie assigned task with 3 milestones to reporting subordinate Dave");
    const createdTask = charlieAssignTaskRes.data.task;

    // Dave retrieves his assigned tasks in Submission Panel
    const daveTasksRes = await getJson(`${BASE}/tasks`, daveAuthToken);
    assert(daveTasksRes.status === 200, "Dave retrieved tasks for Submission Panel");
    const daveTask = daveTasksRes.data.find((t) => t._id === createdTask._id);
    assert(daveTask && daveTask.assignedTo._id === daveUser.id, "Dave sees 'Implement Core Data Parser' assigned to him");
    assert(daveTask.milestones?.length === 3, `Task has 3 independent milestones. Found: ${daveTask.milestones?.length}`);

    // Dave submits deliverable for review
    const submitRes = await postJson(
      `${BASE}/tasks/${daveTask._id}/submit`,
      { submissionNotes: "Core data parser is ready with 100% test coverage." },
      daveAuthToken
    );
    assert(submitRes.status === 200, "Dave submitted deliverable for review");

    // Verify Charlie (the reporting supervisor) received notification
    const charlieNotifsRes = await getJson(`${BASE}/notifications`, charlieAuthToken);
    const charlieNotifs = charlieNotifsRes.data.notifications || [];
    const submissionNotif = charlieNotifs.find((n) => n.title.includes("Submitted") || n.message.includes("Implement Core Data Parser"));
    assert(Boolean(submissionNotif), "Charlie received notification that Dave submitted deliverable for review");

    // Charlie reviews and approves work
    const reviewRes = await postJson(
      `${BASE}/tasks/${daveTask._id}/review`,
      { decision: "approved", feedback: "Outstanding implementation." },
      charlieAuthToken
    );
    assert(reviewRes.status === 200, "Charlie approved Dave's submission");

    // =========================================================
    // TEST 11: Milestone Completion and Notifications
    // =========================================================
    console.log("\n--- TEST 11: Milestone Completion and Tracking ---");
    // Create new task for Dave with 2 milestones
    const task2Res = await postJson(
      `${BASE}/tasks`,
      {
        title: "API Endpoint Optimization",
        assignedTo: daveUser.id,
        milestones: ["Profile Latency Bottlenecks", "Add Redis Cache Layer"],
      },
      charlieAuthToken
    );
    const task2 = task2Res.data.task;
    const ms1 = task2.milestones[0];
    const ms2 = task2.milestones[1];

    // Dave completes Milestone 1
    const ms1CompleteRes = await patchJson(
      `${BASE}/tasks/${task2._id}/milestones/${ms1.id || ms1._id}/complete`,
      {},
      daveAuthToken
    );
    assert(ms1CompleteRes.status === 200, "Dave clicked Complete on Milestone 1");
    const updatedTaskAfterMs1 = ms1CompleteRes.data.task;
    assert(updatedTaskAfterMs1.progress === 50, "Task progress auto-updated to 50% (1 of 2 milestones done)");
    const updatedMs1 = updatedTaskAfterMs1.milestones.find((m) => m.title === "Profile Latency Bottlenecks");
    assert(updatedMs1.completed === true, "Milestone 1 marked completed in database");
    assert(Boolean(updatedMs1.completedAt), "Milestone 1 recorded completion timestamp");

    // Verify activity history recorded in TaskUpdate
    const taskUpdates = await TaskUpdate.find({ taskId: task2._id });
    assert(
      taskUpdates.some((u) => u.comment.includes("Profile Latency Bottlenecks")),
      "TaskUpdate activity recorded milestone completion"
    );

    // Verify Charlie notified of milestone completion
    const notifsAfterMs = await getJson(`${BASE}/notifications`, charlieAuthToken);
    const msNotif = (notifsAfterMs.data.notifications || []).find((n) =>
      n.title.includes("Milestone Completed") && n.message.includes("Profile Latency Bottlenecks")
    );
    assert(Boolean(msNotif), "Charlie notified when Dave completed Milestone 1");

    // Complete Milestone 2
    const ms2CompleteRes = await patchJson(
      `${BASE}/tasks/${task2._id}/milestones/${ms2.id || ms2._id}/complete`,
      {},
      daveAuthToken
    );
    assert(ms2CompleteRes.status === 200, "Dave completed Milestone 2 independently");
    assert(ms2CompleteRes.data.task.progress === 100, "Task progress auto-updated to 100% on all milestones completed");

    // =========================================================
    // TEST 12: Existing functionality remains unaffected
    // =========================================================
    console.log("\n--- TEST 12: Existing Functionality Unaffected ---");
    // Meeting creation and conflict checking
    const meetingRes = await postJson(
      `${BASE}/meetings`,
      {
        title: "Sprint Planning Session",
        date: "2026-11-05",
        startTime: "10:00",
        endTime: "11:00",
        participants: [adminUser.id, bobUser.id, charlieUser.id],
      },
      adminToken
    );
    if (meetingRes.status !== 201) {
      console.error("Meeting creation error:", meetingRes.status, meetingRes.data);
    }
    assert(meetingRes.status === 201, "Calendar meeting created successfully");

    // Profile update
    const profileRes = await patchJson(
      `${BASE}/auth/profile`,
      { designation: "Chief Executive Leader" },
      adminToken
    );
    assert(profileRes.status === 200, "User profile updated successfully");

    console.log("\n=================================================");
    console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log("=================================================");

    server.close();
    await mongoose.disconnect();
    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error("Test execution fatal error:", err);
    server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
