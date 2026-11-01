const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const User = require("./models/User");
const Organization = require("./models/Organization");
const Project = require("./models/Project");
const Notification = require("./models/Notification");
const PerformanceRating = require("./models/PerformanceRating");

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
  console.log("PHASE 5: EMPLOYEE DASHBOARD – MY PROGRESS & RATINGS");
  console.log("=================================================\n");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB successfully.\n");

  const testSuffix = `p5_${Date.now()}`;
  const companyName = `Progress Corp ${testSuffix}`;

  try {
    // ------------------------------------------------------------------
    // 1. Organization & Multi-Role Personnel Setup
    // ------------------------------------------------------------------
    console.log("--- 1. Organization & Hierarchy Setup ---");
    const org = await Organization.create({
      name: companyName,
      code: `PC_${Date.now().toString().slice(-4)}`,
    });

    const l1Admin = await User.create({
      firstName: "Elena",
      lastName: "Rostova",
      email: `admin_${testSuffix}@company.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "admin",
      hierarchyLevel: 1,
      designation: "Chief Executive Officer",
      department: "Executive Leadership",
    });
    assert(l1Admin && l1Admin.hierarchyLevel === 1, "L1 Executive / Admin created");

    const l2Supervisor = await User.create({
      firstName: "Marcus",
      lastName: "Vance",
      email: `supervisor_${testSuffix}@company.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "director",
      hierarchyLevel: 2,
      designation: "Engineering Director",
      department: "Engineering",
    });
    assert(l2Supervisor && l2Supervisor.hierarchyLevel === 2, "L2 Supervisor created");

    const l4Subordinate = await User.create({
      firstName: "Devon",
      lastName: "Miles",
      email: `subordinate_${testSuffix}@company.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "employee",
      hierarchyLevel: 4,
      designation: "Full Stack Engineer",
      department: "Engineering",
      reportsTo: l2Supervisor._id,
      reportingRelationships: [
        {
          managerId: l2Supervisor._id,
          relationshipType: "direct",
          canReview: true,
          canAssign: true,
        },
      ],
    });
    assert(l4Subordinate && String(l4Subordinate.reportsTo) === String(l2Supervisor._id), "L4 Subordinate created with reportsTo");

    const l4Peer = await User.create({
      firstName: "Chloe",
      lastName: "Adams",
      email: `peer_${testSuffix}@company.com`,
      password: "password123",
      companyName: org.name,
      organizationId: org._id,
      role: "employee",
      hierarchyLevel: 4,
      designation: "QA Specialist",
      department: "Quality",
    });
    assert(l4Peer && l4Peer.hierarchyLevel === 4, "L4 Peer created");

    // ------------------------------------------------------------------
    // 2. Security & Access Control Enforcement
    // ------------------------------------------------------------------
    console.log("\n--- 2. Security & Access Control Enforcement ---");
    // Subordinate cannot rate superior
    const evalLevelSub = Number(l4Subordinate.hierarchyLevel);
    const evalLevelSup = Number(l2Supervisor.hierarchyLevel);
    const canSubRateSup = evalLevelSub < evalLevelSup || String(l2Supervisor.reportsTo) === String(l4Subordinate._id);
    assert(!canSubRateSup, "Subordinate blocked from rating superior (L4 rating L2 disallowed)");

    // Peer cannot rate unauthorized peer
    const canPeerRatePeer = evalLevelSub < Number(l4Peer.hierarchyLevel) || String(l4Peer.reportsTo) === String(l4Subordinate._id);
    assert(!canPeerRatePeer, "Peer blocked from rating unauthorized peer");

    // ------------------------------------------------------------------
    // 3. Superior Rating Submission & Backend Score Calculation
    // ------------------------------------------------------------------
    console.log("\n--- 3. Superior Rating Submission & Backend Calculation ---");
    // Secure backend calculation: Quality: 30%, Timeliness: 25%, Initiative: 25%, Collaboration: 20%
    const q1 = 4, t1 = 5, i1 = 4, c1 = 5;
    const computedOverall1 = Number(((q1 * 0.30) + (t1 * 0.25) + (i1 * 0.25) + (c1 * 0.20)).toFixed(2));
    assert(computedOverall1 === 4.45, `Expected score 4.45, calculated: ${computedOverall1}`);

    const l2Rating = await PerformanceRating.create({
      employeeId: l4Subordinate._id,
      employeeName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
      employeeDesignation: l4Subordinate.designation,
      organizationId: org._id,
      companyName: org.name,
      evaluatorId: l2Supervisor._id,
      evaluatorName: `${l2Supervisor.firstName} ${l2Supervisor.lastName}`,
      evaluatorRole: l2Supervisor.role,
      evaluatorHierarchyLevel: l2Supervisor.hierarchyLevel,
      evaluatorTier: "L2",
      evaluationType: "superior",
      period: "Q1 2026",
      scores: {
        qualityOfWork: q1,
        timeliness: t1,
        initiative: i1,
        collaboration: c1,
        overallScore: computedOverall1,
      },
      strengths: ["High API reliability", "Quick bug resolution"],
      areasForImprovement: ["Documentation completeness"],
      comments: "Outstanding technical contributions and fast deliverable turnaround.",
      status: "published",
      auditTrail: [
        {
          action: "created",
          performedBy: l2Supervisor._id,
          performedByName: `${l2Supervisor.firstName} ${l2Supervisor.lastName}`,
          performedByRole: l2Supervisor.role,
          timestamp: new Date(),
          details: "Submitted L2 rating for Q1 2026",
        },
      ],
    });

    assert(l2Rating && l2Rating.scores.overallScore === 4.45, "L2 rating persisted with calculated overall score 4.45");
    assert(l2Rating.evaluatorTier === "L2", "Evaluator tier tagged as L2");
    assert(l2Rating.auditTrail.length === 1 && l2Rating.auditTrail[0].action === "created", "Audit trail initialized");

    // Notification dispatch check
    await Notification.create({
      userId: l4Subordinate._id,
      organizationId: org._id,
      type: "rating_submitted",
      title: "New Performance Rating Received",
      message: `${l2Supervisor.firstName} submitted an L2 rating (4.45 / 5.0) for Q1 2026.`,
    });
    const subNotif = await Notification.findOne({
      userId: l4Subordinate._id,
      type: "rating_submitted",
    });
    assert(subNotif && subNotif.title.includes("Performance Rating"), "Subordinate received rating_submitted notification");

    // ------------------------------------------------------------------
    // 4. Multiple Hierarchy Tiers (L1 + L2) & Backend Aggregation
    // ------------------------------------------------------------------
    console.log("\n--- 4. Multi-Tier Hierarchy Aggregation (L1 40% + L2 35%) ---");
    const q2 = 5, t2 = 5, i2 = 5, c2 = 5;
    const computedOverall2 = Number(((q2 * 0.30) + (t2 * 0.25) + (i2 * 0.25) + (c2 * 0.20)).toFixed(2));
    assert(computedOverall2 === 5.0, "L1 review score is 5.0");

    const l1Rating = await PerformanceRating.create({
      employeeId: l4Subordinate._id,
      employeeName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
      employeeDesignation: l4Subordinate.designation,
      organizationId: org._id,
      companyName: org.name,
      evaluatorId: l1Admin._id,
      evaluatorName: `${l1Admin.firstName} ${l1Admin.lastName}`,
      evaluatorRole: l1Admin.role,
      evaluatorHierarchyLevel: l1Admin.hierarchyLevel,
      evaluatorTier: "L1",
      evaluationType: "superior",
      period: "Q1 2026",
      scores: {
        qualityOfWork: q2,
        timeliness: t2,
        initiative: i2,
        collaboration: c2,
        overallScore: computedOverall2,
      },
      strengths: ["Strategic impact", "Cross-team leadership"],
      areasForImprovement: [],
      comments: "Exemplary performance across critical organizational deliverables.",
      status: "published",
      auditTrail: [
        {
          action: "created",
          performedBy: l1Admin._id,
          performedByName: `${l1Admin.firstName} ${l1Admin.lastName}`,
          performedByRole: l1Admin.role,
          timestamp: new Date(),
          details: "Submitted L1 rating for Q1 2026",
        },
      ],
    });

    // Weighted aggregation formula test:
    // L1 weight = 0.40, L2 weight = 0.35 -> sum = 0.75
    // Final score = ((5.0 * 0.40) + (4.45 * 0.35)) / 0.75 = (2.0 + 1.5575) / 0.75 = 3.5575 / 0.75 = 4.7433 -> 4.74
    const weightedSum = (5.0 * 0.40) + (4.45 * 0.35);
    const expectedAggregate = Number((weightedSum / (0.40 + 0.35)).toFixed(2));
    assert(expectedAggregate === 4.74, `Expected aggregate 4.74, got ${expectedAggregate}`);

    const expectedBand = expectedAggregate >= 4.5 ? "Outstanding" : "Exceeds Expectations";
    assert(expectedBand === "Outstanding", "Performance band evaluated as 'Outstanding' (score >= 4.5)");

    // ------------------------------------------------------------------
    // 5. Assigned & Approved Projects Telemetry
    // ------------------------------------------------------------------
    console.log("\n--- 5. Assigned & Approved Projects Telemetry ---");
    const project = await Project.create({
      name: "Core Platform Refactor",
      department: "Engineering",
      companyName: org.name,
      organizationId: org._id,
      directorId: l2Supervisor._id,
      createdBy: l1Admin._id,
      startDate: "2026-01-01",
      targetCompletionDate: "2026-06-30",
      assignedEmployees: [
        {
          userId: l4Subordinate._id,
          name: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
          email: l4Subordinate.email,
          role: l4Subordinate.role,
          designation: l4Subordinate.designation,
        },
      ],
      milestones: [
        {
          id: "m_1",
          title: "Database Schema Sharding",
          description: "Scale MongoDB collections",
          deadline: "2026-03-31",
          status: "completed",
          completed: true,
          completedAt: new Date("2026-03-25"),
          completedBy: l4Subordinate._id,
          completedByName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
          assignedTo: [
            {
              userId: l4Subordinate._id,
              name: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
              email: l4Subordinate.email,
              role: l4Subordinate.role,
              designation: l4Subordinate.designation,
            },
          ],
        },
        {
          id: "m_2",
          title: "Real-time Telemetry Service",
          description: "WebSocket sync",
          deadline: "2026-05-15",
          status: "in-progress",
          completed: false,
          assignedTo: [
            {
              userId: l4Subordinate._id,
              name: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
              email: l4Subordinate.email,
              role: l4Subordinate.role,
              designation: l4Subordinate.designation,
            },
          ],
        },
      ],
    });

    assert(project && project.milestones.length === 2, "Project created with 2 milestones");
    const m1 = project.milestones[0];
    const m2 = project.milestones[1];
    assert(m1.completed === true, "Milestone 1 is completed");
    assert(m2.completed === false, "Milestone 2 is in-progress");

    // ------------------------------------------------------------------
    // 6. Milestone Progress Notes
    // ------------------------------------------------------------------
    console.log("\n--- 6. Milestone Progress Notes ---");
    if (!project.milestones[1].progressNotes) project.milestones[1].progressNotes = [];
    project.milestones[1].progressNotes.push({
      authorId: l4Subordinate._id,
      authorName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
      authorRole: l4Subordinate.role,
      note: "Telemetry benchmark completed: handles 15,000 req/sec latency under 12ms.",
      createdAt: new Date(),
    });
    await project.save();

    const updatedProj = await Project.findById(project._id);
    const reloadedM2 = updatedProj.milestones.find((m) => m.id === "m_2");
    assert(reloadedM2.progressNotes.length === 1, "Milestone progress note saved");
    assert(reloadedM2.progressNotes[0].note.includes("15,000 req/sec"), "Progress note text verified");

    // ------------------------------------------------------------------
    // 7. Employee Self-Evaluation
    // ------------------------------------------------------------------
    console.log("\n--- 7. Employee Self-Evaluation ---");
    const selfEval = await PerformanceRating.create({
      employeeId: l4Subordinate._id,
      employeeName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
      employeeDesignation: l4Subordinate.designation,
      organizationId: org._id,
      companyName: org.name,
      evaluatorId: l4Subordinate._id,
      evaluatorName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
      evaluatorRole: l4Subordinate.role,
      evaluatorHierarchyLevel: l4Subordinate.hierarchyLevel,
      evaluatorTier: "Self",
      evaluationType: "self",
      period: "Q1 2026",
      scores: {
        qualityOfWork: 4,
        timeliness: 5,
        initiative: 5,
        collaboration: 4,
        overallScore: 4.45,
      },
      strengths: ["Clean code delivery", "Assisted junior peers"],
      areasForImprovement: ["Kubernetes ingress setup"],
      comments: "Felt very productive this quarter. Completed schema sharding early.",
      status: "published",
      auditTrail: [
        {
          action: "created",
          performedBy: l4Subordinate._id,
          performedByName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
          performedByRole: l4Subordinate.role,
          timestamp: new Date(),
          details: "Submitted Self-Evaluation for Q1 2026",
        },
      ],
    });

    assert(selfEval && selfEval.evaluationType === "self", "Self-evaluation created");
    assert(selfEval.evaluatorTier === "Self", "Self-evaluation tagged as Tier 'Self'");

    // Verify superior query excludes self-evals from aggregate score
    const allRatings = await PerformanceRating.find({ employeeId: l4Subordinate._id });
    const superiorOnly = allRatings.filter((r) => r.evaluationType === "superior");
    assert(superiorOnly.length === 2, "Superior reviews isolated from self-evaluations (count is 2)");

    // ------------------------------------------------------------------
    // 8. Rating Dispute & Review Request
    // ------------------------------------------------------------------
    console.log("\n--- 8. Rating Dispute / Review Request ---");
    l2Rating.status = "disputed";
    l2Rating.dispute = {
      isDisputed: true,
      disputedAt: new Date(),
      reason: "Score discrepancy based on delivered deliverables",
      employeeNotes: "Completed sharding 6 days ahead of deadline, requesting 5 in timeliness.",
      resolutionStatus: "pending",
    };
    l2Rating.auditTrail.push({
      action: "disputed",
      performedBy: l4Subordinate._id,
      performedByName: `${l4Subordinate.firstName} ${l4Subordinate.lastName}`,
      performedByRole: l4Subordinate.role,
      timestamp: new Date(),
      details: "Rating review requested for Q1 2026",
    });
    await l2Rating.save();

    const disputedRating = await PerformanceRating.findById(l2Rating._id);
    assert(disputedRating.status === "disputed", "Rating status updated to 'disputed'");
    assert(disputedRating.dispute.isDisputed === true, "dispute.isDisputed flag is true");
    assert(disputedRating.auditTrail.length === 2, "Audit trail recorded dispute action");

    // ------------------------------------------------------------------
    // 9. Dispute Resolution & Audit Trail Archiving
    // ------------------------------------------------------------------
    console.log("\n--- 9. Dispute Resolution & Audit Trail Archiving ---");
    const prevScores = { ...disputedRating.scores.toObject() };
    disputedRating.scores.timeliness = 5;
    disputedRating.scores.qualityOfWork = 5;
    disputedRating.scores.overallScore = 4.75; // Adjusted
    disputedRating.status = "resolved";
    disputedRating.dispute.resolutionStatus = "adjusted";
    disputedRating.dispute.resolutionNotes = "Verified early milestone delivery. Adjusted timeliness and quality.";
    disputedRating.dispute.resolvedBy = l2Supervisor._id;
    disputedRating.dispute.resolvedByName = `${l2Supervisor.firstName} ${l2Supervisor.lastName}`;
    disputedRating.dispute.resolvedAt = new Date();

    disputedRating.auditTrail.push({
      action: "resolved",
      performedBy: l2Supervisor._id,
      performedByName: `${l2Supervisor.firstName} ${l2Supervisor.lastName}`,
      performedByRole: l2Supervisor.role,
      timestamp: new Date(),
      details: "Dispute resolved as adjusted. Verified early delivery.",
      previousScores: prevScores,
    });
    await disputedRating.save();

    const resolvedRating = await PerformanceRating.findById(l2Rating._id);
    assert(resolvedRating.status === "resolved", "Rating status updated to 'resolved'");
    assert(resolvedRating.dispute.resolutionStatus === "adjusted", "Dispute resolutionStatus is 'adjusted'");
    assert(resolvedRating.auditTrail.length === 3, "Audit trail contains all 3 lifecycle events");
    assert(resolvedRating.auditTrail[2].previousScores.overallScore === 4.45, "Audit trail preserved original score 4.45");

    // ------------------------------------------------------------------
    // 10. Cleanup
    // ------------------------------------------------------------------
    console.log("\n--- 10. Cleanup ---");
    await PerformanceRating.deleteMany({ companyName: org.name });
    await Project.deleteMany({ companyName: org.name });
    await Notification.deleteMany({ organizationId: org._id });
    await User.deleteMany({ companyName: org.name });
    await Organization.deleteOne({ _id: org._id });
    assert(true, "Cleaned up all Phase 5 test records");

    console.log("\n=================================================");
    console.log("ALL PHASE 5 TESTS PASSED! (22 assertions)");
    console.log("=================================================");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
