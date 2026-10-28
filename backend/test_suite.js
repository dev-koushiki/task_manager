const mongoose = require("mongoose");
const http = require("http");
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes");
const organizationRoutes = require("./routes/organizationRoutes");

const User = require("./models/User");
const Organization = require("./models/Organization");
const Project = require("./models/Project");
const Task = require("./models/Task");

async function runTestSuite() {
  console.log("=================================================");
  console.log("STARTING RBAC, HIERARCHY & MULTI-TENANCY TEST SUITE");
  console.log("=================================================\n");

  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager";
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log("Connected to MongoDB.");

  // Build Express App
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/organization", organizationRoutes);

  const TEST_PORT = 5099;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://localhost:${TEST_PORT}/api`;
  console.log(`Test API Server running on ${BASE_URL}\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Existing User & Data Preservation
    // ----------------------------------------------------
    console.log("--- TEST 1: Existing User & Company Preservation ---");
    const existingUser = await User.findOne({ email: "koushikipodder432@gmail.com" });
    assert(existingUser !== null, "Existing user 'koushikipodder432@gmail.com' is preserved");
    assert(existingUser.companyName === "pentile", "Company name 'pentile' is preserved");
    assert(existingUser.organizationId !== null, "Existing user has organizationId linked");
    const existingOrg = await Organization.findById(existingUser.organizationId);
    assert(existingOrg !== null, "Organization document for 'pentile' exists in DB");
    console.log("");

    // ----------------------------------------------------
    // TEST 2: Multi-Company Registration & Data Isolation
    // ----------------------------------------------------
    console.log("--- TEST 2: Multi-Company Registration & Strict Isolation ---");
    const testTimestamp = Date.now();
    const companyAEmail = `admin_a_${testTimestamp}@acme.com`;
    const companyBEmail = `admin_b_${testTimestamp}@beta.com`;

    // Register Admin Company A
    const resRegA = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Alice",
        lastName: "Acme",
        email: companyAEmail,
        password: "password123",
        companyName: `Acme Corp ${testTimestamp}`,
        designation: "CEO",
      }),
    });
    const dataRegA = await resRegA.json();
    assert(resRegA.status === 201, "Company A registered successfully");
    const tokenA = dataRegA.token;
    const orgIdA = dataRegA.user.organizationId;

    // Register Admin Company B
    const resRegB = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Bob",
        lastName: "Beta",
        email: companyBEmail,
        password: "password123",
        companyName: `Beta Labs ${testTimestamp}`,
        designation: "Managing Director",
      }),
    });
    const dataRegB = await resRegB.json();
    assert(resRegB.status === 201, "Company B registered successfully");
    const tokenB = dataRegB.token;
    const orgIdB = dataRegB.user.organizationId;
    assert(orgIdA !== orgIdB, "Company A and Company B have completely distinct Organization IDs");

    // Company A creates a project
    const resProjA = await fetch(`${BASE_URL}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: "Acme Falcon Project",
        description: "Confidential Project A",
        deadline: "2026-12-31",
      }),
    });
    const dataProjA = await resProjA.json();
    assert(resProjA.status === 201, "Company A creates project successfully");
    const projectAId = dataProjA.project._id;

    // Company A creates a task
    const resTaskA = await fetch(`${BASE_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: "Confidential Falcon Blueprint",
        projectId: projectAId,
        deadline: "2026-11-30",
      }),
    });
    const dataTaskA = await resTaskA.json();
    assert(resTaskA.status === 201, "Company A creates task successfully");
    const taskAId = dataTaskA.task._id;

    // Company B lists projects -> MUST NOT SEE Project A
    const resListProjB = await fetch(`${BASE_URL}/projects`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const listProjB = await resListProjB.json();
    assert(
      !listProjB.some((p) => p._id === projectAId || p.name === "Acme Falcon Project"),
      "Cross-Company Isolation: Company B cannot see Company A's projects"
    );

    // Company B lists tasks -> MUST NOT SEE Task A
    const resListTaskB = await fetch(`${BASE_URL}/tasks`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const listTaskB = await resListTaskB.json();
    assert(
      !listTaskB.some((t) => t._id === taskAId || t.title === "Confidential Falcon Blueprint"),
      "Cross-Company Isolation: Company B cannot see Company A's tasks"
    );

    // Cross-Company Unauthorized Access Test: Company B attempts to edit Company A's task
    const resTamper = await fetch(`${BASE_URL}/tasks/${taskAId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ title: "Hacked by Company B" }),
    });
    assert(
      resTamper.status === 404 || resTamper.status === 403,
      "Cross-Company Defense: Company B cannot edit Company A's task (404/403 enforced)"
    );

    // Cross-Company Unauthorized Delete Test: Company B attempts to delete Company A's project
    const resDeleteTamper = await fetch(`${BASE_URL}/projects/${projectAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      resDeleteTamper.status === 404 || resDeleteTamper.status === 403,
      "Cross-Company Defense: Company B cannot delete Company A's project (404/403 enforced)"
    );
    console.log("");

    // ----------------------------------------------------
    // TEST 3: Dynamic Hierarchy, Departments & Teams
    // ----------------------------------------------------
    console.log("--- TEST 3: Dynamic Departments, Teams & Custom Roles ---");
    // Add custom department to Company A
    const resAddDept = await fetch(`${BASE_URL}/organization/departments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "Robotics & AI" }),
    });
    assert(resAddDept.status === 201, "Company A added custom department 'Robotics & AI'");

    // Add custom team to Company A
    const resAddTeam = await fetch(`${BASE_URL}/organization/teams`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: "Autonomous Drones Squad",
        department: "Robotics & AI",
        description: "Vision and aerial navigation",
      }),
    });
    const dataTeam = await resAddTeam.json();
    assert(resAddTeam.status === 201, "Company A created team 'Autonomous Drones Squad'");
    assert(dataTeam.team.name === "Autonomous Drones Squad", "Team name stored correctly");

    // Add custom job role with Granular RBAC Permissions and Access Scopes
    const resAddPos = await fetch(`${BASE_URL}/organization/positions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: "Senior Flight Dynamics Lead",
        level: 2,
        department: "Robotics & AI",
        permissions: {
          canCreateTasks: true,
          canAssignTasks: true,
          canEditTasks: true,
          canApproveTasks: true,
          canDeleteTasks: false,
          canViewTasks: true,
          canCreateProjects: true,
          canManageEmployees: false,
        },
        accessScopes: {
          taskScope: "department",
          projectScope: "project",
          employeeScope: "department",
          reportScope: "department",
        },
      }),
    });
    const dataPos = await resAddPos.json();
    assert(resAddPos.status === 201, "Company A created custom job role with granular RBAC & scopes");
    assert(dataPos.position.accessScopes.taskScope === "department", "Position taskScope set to 'department'");
    console.log("");

    // ----------------------------------------------------
    // TEST 4: Multiple Managers per Employee & Relationship Types
    // ----------------------------------------------------
    console.log("--- TEST 4: Multiple Managers & Relationship Types ---");

    // Invite Employee 1 (Lead), Employee 2 (Manager), Employee 3 (Contributor)
    const resInv1 = await fetch(`${BASE_URL}/admin/employees/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: "Carl Lead",
        email: `carl_${testTimestamp}@acme.com`,
        department: "Robotics & AI",
        role: "director",
        hierarchyLevel: 2,
        positionTitle: "Senior Flight Dynamics Lead",
      }),
    });
    const dataInv1 = await resInv1.json();
    assert(resInv1.status === 201, "Invited Carl Lead");

    // Accept Carl's invite to create active user
    const resAcc1 = await fetch(`${BASE_URL}/auth/register/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken: dataInv1.inviteToken,
        password: "password123",
      }),
    });
    const dataAcc1 = await resAcc1.json();
    const carlId = dataAcc1.user.id;
    const tokenCarl = dataAcc1.token;

    // Invite Dana Manager
    const resInv2 = await fetch(`${BASE_URL}/admin/employees/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: "Dana Manager",
        email: `dana_${testTimestamp}@acme.com`,
        department: "Robotics & AI",
        role: "manager",
        hierarchyLevel: 3,
        positionTitle: "Robotics Team Lead",
      }),
    });
    const dataInv2 = await resInv2.json();

    const resAcc2 = await fetch(`${BASE_URL}/auth/register/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken: dataInv2.inviteToken,
        password: "password123",
      }),
    });
    const dataAcc2 = await resAcc2.json();
    const danaId = dataAcc2.user.id;
    const tokenDana = dataAcc2.token;

    // Invite Evan Specialist
    const resInv3 = await fetch(`${BASE_URL}/admin/employees/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: "Evan Specialist",
        email: `evan_${testTimestamp}@acme.com`,
        department: "Robotics & AI",
        role: "employee",
        hierarchyLevel: 4,
        positionTitle: "Software Specialist",
      }),
    });
    const dataInv3 = await resInv3.json();

    const resAcc3 = await fetch(`${BASE_URL}/auth/register/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken: dataInv3.inviteToken,
        password: "password123",
      }),
    });
    const dataAcc3 = await resAcc3.json();
    const evanId = dataAcc3.user.id;
    const tokenEvan = dataAcc3.token;

    // Assign multiple managers to Evan Specialist:
    // Manager 1: Dana Manager as Direct Manager
    // Manager 2: Carl Lead as Project Manager
    // Manager 3: Alice Admin as Functional Manager
    const resMultiMgr = await fetch(`${BASE_URL}/admin/hierarchy/managers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        employeeId: evanId,
        relationships: [
          { managerId: danaId, relationshipType: "direct" },
          { managerId: carlId, relationshipType: "project" },
          { managerId: dataRegA.user.id, relationshipType: "functional" },
        ],
      }),
    });
    const dataMultiMgr = await resMultiMgr.json();
    assert(resMultiMgr.status === 200, "Assigned multiple managers to Evan successfully");
    assert(
      dataMultiMgr.employee.reportingRelationships.length === 3,
      "Evan has exactly 3 reporting relationships"
    );
    assert(
      dataMultiMgr.employee.reportingRelationships.some((r) => r.relationshipType === "direct"),
      "Direct manager relationship recorded"
    );
    assert(
      dataMultiMgr.employee.reportingRelationships.some((r) => r.relationshipType === "project"),
      "Project manager relationship recorded"
    );
    assert(
      dataMultiMgr.employee.reportingRelationships.some((r) => r.relationshipType === "functional"),
      "Functional manager relationship recorded"
    );
    const actualReportsToId = dataMultiMgr.employee.reportsTo?._id || dataMultiMgr.employee.reportsTo;
    assert(
      actualReportsToId === danaId,
      "reportsTo field automatically synchronized with direct manager for backward compatibility"
    );
    console.log("");

    // ----------------------------------------------------
    // TEST 5: Circular Reporting Prevention
    // ----------------------------------------------------
    console.log("--- TEST 5: Circular Reporting Relationship Prevention ---");

    // Case 5.1: Self-Reporting: Dana attempts to report to Dana
    const resSelfCycle = await fetch(`${BASE_URL}/admin/hierarchy/assign-supervisor`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        employeeId: danaId,
        supervisorId: danaId,
      }),
    });
    assert(resSelfCycle.status === 400, "Self-reporting prevented with 400 Bad Request");

    // Case 5.2: Direct Cycle: Set Dana to report to Carl, then attempt Carl to report to Dana
    await fetch(`${BASE_URL}/admin/hierarchy/assign-supervisor`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        employeeId: danaId,
        supervisorId: carlId,
      }),
    });

    const resDirectCycle = await fetch(`${BASE_URL}/admin/hierarchy/assign-supervisor`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        employeeId: carlId,
        supervisorId: danaId,
      }),
    });
    const dataDirectCycle = await resDirectCycle.json();
    assert(resDirectCycle.status === 400, "Direct circular reporting loop prevented (Carl -> Dana -> Carl)");
    assert(
      dataDirectCycle.message.toLowerCase().includes("circular"),
      "Clear error message explaining circular reporting loop returned"
    );

    // Case 5.3: Transitive Multi-Hop Cycle:
    // Dana reports to Carl. Evan reports to Dana.
    // Attempt Carl to report to Evan -> loop Carl -> Evan -> Dana -> Carl
    const resMultiHopCycle = await fetch(`${BASE_URL}/admin/hierarchy/managers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        employeeId: carlId,
        relationships: [{ managerId: evanId, relationshipType: "functional" }],
      }),
    });
    assert(resMultiHopCycle.status === 400, "Multi-hop circular reporting loop prevented (Carl -> Evan -> Dana -> Carl)");
    console.log("");

    // ----------------------------------------------------
    // TEST 6: RBAC Permissions & Approval Enforcement
    // ----------------------------------------------------
    console.log("--- TEST 6: Granular RBAC Action Enforcement & Approvals ---");

    // Employee Evan attempts to create a project -> MUST BE FORBIDDEN (403)
    const resEvanProj = await fetch(`${BASE_URL}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenEvan}`,
      },
      body: JSON.stringify({ name: "Evan Unauthorized Project", deadline: "2026-12-31" }),
    });
    assert(resEvanProj.status === 403, "RBAC: Employee without canCreateProjects forbidden from creating projects (403)");

    // Director Carl creates task for Evan
    const resTaskForEvan = await fetch(`${BASE_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCarl}`,
      },
      body: JSON.stringify({
        title: "Navigation Algorithm V1",
        assignedTo: evanId,
        projectId: projectAId,
        deadline: "2026-11-20",
      }),
    });
    const dataTaskEvan = await resTaskForEvan.json();
    assert(resTaskForEvan.status === 201, "Supervisor creates task assigned to subordinate");
    const evanTaskId = dataTaskEvan.task._id;

    // Evan updates progress to 100% and submits for review
    const resSubmit = await fetch(`${BASE_URL}/tasks/${evanTaskId}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenEvan}`,
      },
      body: JSON.stringify({ submissionNotes: "Flight code complete and unit-tested." }),
    });
    const dataSubmit = await resSubmit.json();
    assert(resSubmit.status === 200, "Employee successfully submits deliverable for review");
    assert(dataSubmit.task.status === "submitted", "Task status is 'submitted'");

    // Another unrelated employee from Company B attempts to approve this task -> MUST BE 404/403
    const resTamperApprove = await fetch(`${BASE_URL}/tasks/${evanTaskId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ decision: "approved" }),
    });
    assert(
      resTamperApprove.status === 404 || resTamperApprove.status === 403,
      "RBAC & Multi-Tenancy: Company B cannot review Company A's task"
    );

    // Evan's supervisor Carl (Project Manager) approves the task
    const resSupervisorApprove = await fetch(`${BASE_URL}/tasks/${evanTaskId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCarl}`,
      },
      body: JSON.stringify({ decision: "approved", feedback: "Excellent flight control work!" }),
    });
    const dataApproved = await resSupervisorApprove.json();
    assert(resSupervisorApprove.status === 200, "Supervisor approves task successfully");
    assert(dataApproved.task.status === "completed", "Task status is now 'completed'");
    assert(dataApproved.task.progress === 100, "Task progress is 100%");
    console.log("");

    console.log("=================================================");
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests})`);
    console.log("=================================================");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
