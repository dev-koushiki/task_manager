const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const User = require("./models/User");
const Organization = require("./models/Organization");
const Project = require("./models/Project");
const Task = require("./models/Task");
const Group = require("./models/Group");
const Message = require("./models/Message");
const Meeting = require("./models/Meeting");
const Notification = require("./models/Notification");

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://koushikiudemy_db_user:koushiki123@cluster0.emsh8jh.mongodb.net/task_manager?retryWrites=true&w=majority";

const assert = (condition, msg) => {
  if (!condition) {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${msg}`);
  }
};

async function runTests() {
  console.log("=================================================");
  console.log("PHASE 7: GLOBAL SEARCH MULTI-CATEGORY VERIFICATION");
  console.log("=================================================\n");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB successfully.\n");

  const testSuffix = `p7_${Date.now()}`;
  const companyName = `OmniSearch Corp ${testSuffix}`;

  try {
    // ------------------------------------------------------------------
    // 1. Organization & User Setup
    // ------------------------------------------------------------------
    console.log("--- 1. Organization & User Setup ---");
    const org = await Organization.create({
      name: companyName,
      code: `OMNI_${Date.now().toString().slice(-4)}`,
    });

    const admin = await User.create({
      firstName: "SearchAdmin",
      lastName: "Director",
      email: `admin_${testSuffix}@omnisearch.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "admin",
      designation: "Chief Executive Officer",
      department: "Leadership",
    });

    const employee = await User.create({
      firstName: "SearchColleague",
      lastName: "Developer",
      email: `dev_${testSuffix}@omnisearch.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "employee",
      designation: "Senior Cloud Engineer",
      department: "Engineering",
      team: "Platform",
    });

    assert(admin && employee, "Admin and Employee accounts created");

    // ------------------------------------------------------------------
    // 2. Seed Records Across All 8 Categories with Keyword "Quantum"
    // ------------------------------------------------------------------
    console.log("\n--- 2. Seeding Records across 8 Categories ---");

    // A. Project & Milestone & Concept Note Document
    const project = await Project.create({
      name: `Quantum Platform Architecture ${testSuffix}`,
      description: "Next-gen distributed cloud system using Quantum encryption",
      organizationId: org._id,
      companyName: org.name,
      directorId: admin._id,
      directorName: `${admin.firstName} ${admin.lastName}`,
      createdBy: admin._id,
      startDate: "2026-11-01",
      targetCompletionDate: "2026-12-31",
      deadline: "2026-12-31",
      status: "in-progress",
      department: "Engineering",
      assignedEmployees: [
        {
          userId: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          role: "employee",
          designation: employee.designation,
          team: employee.team,
          assignedAt: new Date(),
        },
      ],
      milestones: [
        {
          title: `Quantum Security Certification ${testSuffix}`,
          description: "Perform end-to-end audit of cryptographic handshakes",
          deadline: "2026-11-20",
          status: "in-progress",
          progress: 50,
          phase: "Phase 1",
        },
      ],
      conceptNote: {
        originalFilename: `Quantum_Architecture_Whitepaper_${testSuffix}.pdf`,
        fileSize: 1048576,
        uploadedAt: new Date(),
        uploadedByName: admin.firstName,
        extractedTitle: "Quantum Distributed Architecture",
      },
    });

    assert(project && project.milestones.length === 1, "Project, Milestone & Concept Note created");

    // B. Task with deliverable document
    const task = await Task.create({
      user: employee._id,
      title: `Implement Quantum Crypto Ciphers ${testSuffix}`,
      description: "Integrate post-quantum key exchange algorithms",
      organizationId: org._id,
      projectId: project._id,
      assignedTo: employee._id,
      assignedToName: `${employee.firstName} ${employee.lastName}`,
      assignedBy: admin._id,
      assignedByName: `${admin.firstName} ${admin.lastName}`,
      status: "in-progress",
      priority: "urgent",
      dueDate: "2026-11-25",
      submissionNotes: `Quantum algorithm benchmark whitepaper submitted for review ${testSuffix}`,
    });

    assert(task && task._id, "Task and deliverable document created");

    // C. Group
    const group = await Group.create({
      name: `Quantum Engineering Guild ${testSuffix}`,
      description: "Cross-functional team building quantum resilience",
      organizationId: org._id,
      createdBy: admin._id,
      createdByName: `${admin.firstName} ${admin.lastName}`,
      isDirectChat: false,
      members: [
        {
          userId: admin._id,
          name: `${admin.firstName} ${admin.lastName}`,
          email: admin.email,
          role: "admin",
        },
        {
          userId: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          role: "member",
        },
      ],
    });

    assert(group && group._id, "Group created with members");

    // D. Message
    const message = await Message.create({
      groupId: group._id,
      organizationId: org._id,
      senderId: admin._id,
      senderName: admin.firstName,
      text: `Quantum encryption keys generated and verified across nodes ${testSuffix}`,
    });

    assert(message && message._id, "Message created in group");

    // E. Meeting
    const meeting = await Meeting.create({
      title: `Quantum Roadmap Sync ${testSuffix}`,
      agenda: "Executive planning for quantum safe migration",
      description: "Executive planning for quantum safe migration",
      organizationId: org._id,
      organizer: admin._id,
      organizerName: `${admin.firstName} ${admin.lastName}`,
      hostId: admin._id,
      hostName: admin.firstName,
      roomCode: `QTM-${Date.now().toString().slice(-4)}`,
      date: "2026-11-10",
      scheduledDate: "2026-11-10",
      startTime: "10:00",
      endTime: "11:00",
      status: "scheduled",
      participants: [
        {
          userId: admin._id,
          name: admin.firstName,
          email: admin.email,
          status: "accepted",
        },
        {
          userId: employee._id,
          name: employee.firstName,
          email: employee.email,
          status: "pending",
        },
      ],
    });

    assert(meeting && meeting._id, "Meeting created with participants");

    // ------------------------------------------------------------------
    // 3. Test Global Search API directly through Express route logic
    // ------------------------------------------------------------------
    console.log("\n--- 3. Testing Global Search Execution ---");

    const searchRouter = require("./routes/searchRoutes");

    // Helper to simulate express route call
    const executeSearch = (userObj, queryParams) => {
      return new Promise((resolve, reject) => {
        const req = {
          user: userObj,
          query: queryParams,
        };
        const res = {
          json: (data) => resolve(data),
          status: (code) => ({
            json: (errData) => reject(new Error(`Status ${code}: ${JSON.stringify(errData)}`)),
          }),
        };
        // Call the route handler directly
        const handler = searchRouter.stack[0].route.stack[1].handle;
        handler(req, res).catch(reject);
      });
    };

    // Test search for "Quantum" across all categories as Admin
    const adminSearchResults = await executeSearch(admin, { q: "Quantum" });
    assert(adminSearchResults.total >= 7, `Search for 'Quantum' returned ${adminSearchResults.total} hits (expected >= 7)`);
    assert(adminSearchResults.counts.projects >= 1, `Project hit found: ${adminSearchResults.counts.projects}`);
    assert(adminSearchResults.counts.milestones >= 1, `Milestone hit found: ${adminSearchResults.counts.milestones}`);
    assert(adminSearchResults.counts.tasks >= 1, `Task hit found: ${adminSearchResults.counts.tasks}`);
    assert(adminSearchResults.counts.groups >= 1, `Group hit found: ${adminSearchResults.counts.groups}`);
    assert(adminSearchResults.counts.messages >= 1, `Message hit found: ${adminSearchResults.counts.messages}`);
    assert(adminSearchResults.counts.meetings >= 1, `Meeting hit found: ${adminSearchResults.counts.meetings}`);
    assert(adminSearchResults.counts.documents >= 1, `Document hit found: ${adminSearchResults.counts.documents}`);

    // Test deep-link formats
    const foundProject = adminSearchResults.results.projects.find((p) => p.id.toString() === project._id.toString());
    assert(foundProject && foundProject.link === `/dashboard?tab=tasks&projectId=${project._id}`, "Project has correct task deep link");

    const foundMilestone = adminSearchResults.results.milestones.find((m) => m.projectId.toString() === project._id.toString());
    assert(foundMilestone && foundMilestone.link.includes(`projectId=${project._id}&milestoneId=`), "Milestone has direct milestone deep link");

    // ------------------------------------------------------------------
    // 4. Test Category Filter
    // ------------------------------------------------------------------
    console.log("\n--- 4. Category-Specific Filtering ---");

    const taskOnlyResults = await executeSearch(admin, { q: "Quantum", category: "tasks" });
    assert(taskOnlyResults.counts.tasks >= 1, "Category filter 'tasks' returned tasks");
    assert(taskOnlyResults.counts.projects === 0, "Non-task category 'projects' is empty");
    assert(taskOnlyResults.counts.meetings === 0, "Non-task category 'meetings' is empty");

    const projectOnlyResults = await executeSearch(admin, { q: "Quantum", category: "projects" });
    assert(projectOnlyResults.counts.projects >= 1, "Category filter 'projects' returned projects");
    assert(projectOnlyResults.counts.tasks === 0, "Non-project category 'tasks' is empty");

    // ------------------------------------------------------------------
    // 5. Test Employee Search
    // ------------------------------------------------------------------
    console.log("\n--- 5. Employee Category Search ---");

    const empSearch = await executeSearch(admin, { q: "SearchColleague" });
    assert(empSearch.counts.employees >= 1, `Employee search found: ${empSearch.counts.employees}`);
    const foundEmp = empSearch.results.employees.find((e) => e.email === employee.email);
    assert(foundEmp && foundEmp.email === employee.email, "Matched employee email");
    assert(!foundEmp.password, "Security: Password hash never exposed in search results");

    // ------------------------------------------------------------------
    // 6. Security Scoping & Cross-Tenant Isolation
    // ------------------------------------------------------------------
    console.log("\n--- 6. Security Scoping & Isolation Check ---");

    // Create record in another organization with keyword "Quantum"
    const foreignOrg = await Organization.create({
      name: `Foreign Corp ${testSuffix}`,
      code: `FOR_${Date.now().toString().slice(-4)}`,
    });

    const foreignProject = await Project.create({
      name: `Foreign Secret Quantum Project ${testSuffix}`,
      organizationId: foreignOrg._id,
      companyName: foreignOrg.name,
      createdBy: new mongoose.Types.ObjectId(),
      targetCompletionDate: "2027-01-01",
      deadline: "2027-01-01",
    });

    const scopedResults = await executeSearch(employee, { q: "Quantum" });
    const leakedForeign = scopedResults.results.projects.some(
      (p) => p.id.toString() === foreignProject._id.toString()
    );

    assert(!leakedForeign, "Cross-tenant security: Foreign organization project is NEVER exposed in search");

    // Test empty query handling
    const emptyResults = await executeSearch(employee, { q: "   " });
    assert(emptyResults.total === 0, "Empty search query gracefully returns 0 results");

    // ------------------------------------------------------------------
    // 7. Cleanup Test Data
    // ------------------------------------------------------------------
    console.log("\n--- 7. Cleanup Test Records ---");
    await User.deleteMany({ email: { $regex: testSuffix } });
    await Organization.deleteMany({ _id: { $in: [org._id, foreignOrg._id] } });
    await Project.deleteMany({ _id: { $in: [project._id, foreignProject._id] } });
    await Task.deleteOne({ _id: task._id });
    await Group.deleteOne({ _id: group._id });
    await Message.deleteOne({ _id: message._id });
    await Meeting.deleteOne({ _id: meeting._id });

    console.log("\n=================================================");
    console.log("ALL PHASE 7 GLOBAL SEARCH TESTS PASSED!");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

runTests();
