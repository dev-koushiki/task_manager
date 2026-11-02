const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const User = require("./models/User");
const Task = require("./models/Task");
const Organization = require("./models/Organization");
const PeriodicEvaluationSnapshot = require("./models/PeriodicEvaluationSnapshot");
const {
  getPeriodDateRange,
  calculateEmployeePerformance,
  calculateOrganizationLeaderboard,
  calculateOrganizationAnalytics,
} = require("./services/performanceEvaluationEngine");

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://koushikiudemy_db_user:koushiki123@cluster0.emsh8jh.mongodb.net/task_manager?retryWrites=true&w=majority";

async function runTests() {
  console.log("=================================================");
  console.log("AUTOMATED EMPLOYEE PERFORMANCE EVALUATION TEST SUITE");
  console.log("=================================================\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log("Connected to MongoDB successfully.\n");

  const testOrgId = new mongoose.Types.ObjectId();
  const testCompanyName = "PerfTestCorp_" + Date.now();

  try {
    // ----------------------------------------------------------------
    // 1. Organization & Employee Accounts Setup
    // ----------------------------------------------------------------
    console.log("--- 1. Organization & Employee Setup ---");
    const testOrg = await Organization.create({
      _id: testOrgId,
      name: testCompanyName,
      code: "PTC",
      departments: ["Engineering", "Design", "Product"],
    });

    const admin = await User.create({
      firstName: "Admin",
      lastName: "Director",
      email: `admin_${Date.now()}@perftest.com`,
      password: "password123",
      role: "admin",
      organizationId: testOrgId,
      companyName: testCompanyName,
      department: "Engineering",
      designation: "Managing Director",
      hierarchyLevel: 1,
    });

    const topPerformer = await User.create({
      firstName: "Alice",
      lastName: "Engineer",
      email: `alice_${Date.now()}@perftest.com`,
      password: "password123",
      role: "employee",
      organizationId: testOrgId,
      companyName: testCompanyName,
      department: "Engineering",
      designation: "Senior Software Engineer",
      hierarchyLevel: 4,
      reportsTo: admin._id,
      employeeId: "EMP-ALICE-01",
    });

    const averagePerformer = await User.create({
      firstName: "Bob",
      lastName: "Designer",
      email: `bob_${Date.now()}@perftest.com`,
      password: "password123",
      role: "employee",
      organizationId: testOrgId,
      companyName: testCompanyName,
      department: "Design",
      designation: "Product Designer",
      hierarchyLevel: 4,
      reportsTo: admin._id,
      employeeId: "EMP-BOB-02",
    });

    const newHireNoTasks = await User.create({
      firstName: "Charlie",
      lastName: "Newbie",
      email: `charlie_${Date.now()}@perftest.com`,
      password: "password123",
      role: "employee",
      organizationId: testOrgId,
      companyName: testCompanyName,
      department: "Product",
      designation: "Associate PM",
      hierarchyLevel: 4,
      reportsTo: admin._id,
      employeeId: "EMP-CHARLIE-03",
    });

    console.log("  ✓ PASS: Created test organization and 4 employees");

    // ----------------------------------------------------------------
    // 2. Date Range Verification (Month, Quarter, Half-Year, Year)
    // ----------------------------------------------------------------
    console.log("\n--- 2. Periodic Date Range Generation ---");
    const mRange = getPeriodDateRange("month", 2026, "2026-11");
    if (mRange.periodLabel.includes("November 2026") && mRange.prevPeriodValue === "2026-10") {
      console.log("  ✓ PASS: Monthly period range verified:", mRange.periodLabel);
    } else {
      throw new Error(`Invalid monthly range: ${JSON.stringify(mRange)}`);
    }

    const qRange = getPeriodDateRange("quarter", 2026, "2026-Q4");
    if (qRange.periodLabel.includes("Q4 2026") && qRange.prevPeriodValue === "2026-Q3") {
      console.log("  ✓ PASS: Quarterly period range verified:", qRange.periodLabel);
    } else {
      throw new Error(`Invalid quarterly range: ${JSON.stringify(qRange)}`);
    }

    const hRange = getPeriodDateRange("half-year", 2026, "2026-H2");
    if (hRange.periodLabel.includes("H2 2026") && hRange.prevPeriodValue === "2026-H1") {
      console.log("  ✓ PASS: Half-Yearly period range verified:", hRange.periodLabel);
    } else {
      throw new Error(`Invalid half-yearly range: ${JSON.stringify(hRange)}`);
    }

    const yRange = getPeriodDateRange("year", 2026);
    if (yRange.periodLabel === "Year 2026" && yRange.prevPeriodValue === "2025") {
      console.log("  ✓ PASS: Yearly period range verified:", yRange.periodLabel);
    } else {
      throw new Error(`Invalid yearly range: ${JSON.stringify(yRange)}`);
    }

    // ----------------------------------------------------------------
    // 3. Task Creation & Activity Simulation for Alice (Top Performer)
    // ----------------------------------------------------------------
    console.log("\n--- 3. Task Activity Simulation: Top Performer (Alice) ---");
    const testProjectId = new mongoose.Types.ObjectId();
    const nov2026Date = new Date(Date.UTC(2026, 10, 5)); // Nov 5, 2026
    const deadline1 = "2026-11-15";
    const deadline2 = "2026-11-20";

    // Task 1: Submitted early, approved on first attempt, comparable first submission!
    const task1 = await Task.create({
      title: "API Microservice Optimization",
      organizationId: testOrgId,
      projectId: testProjectId,
      department: "Engineering",
      assignedTo: topPerformer._id,
      assignedBy: admin._id,
      user: topPerformer._id,
      status: "completed",
      progress: 100,
      priority: "high",
      weight: 3,
      deadline: deadline1,
      createdAt: nov2026Date,
      assignedAt: nov2026Date,
      startedAt: new Date(Date.UTC(2026, 10, 6)),
      firstSubmittedAt: new Date(Date.UTC(2026, 10, 10)), // 5 days before deadline!
      submittedAt: new Date(Date.UTC(2026, 10, 10)),
      submissionCount: 1,
      approvedAt: new Date(Date.UTC(2026, 10, 11)),
      firstAttemptApproved: true,
      isFirstSubmission: true,
      reworkCount: 0,
      workDurationMs: 4 * 24 * 3600 * 1000,
      reviewDurationMs: 1 * 24 * 3600 * 1000,
      reviewHistory: [
        {
          attemptNumber: 1,
          submittedAt: new Date(Date.UTC(2026, 10, 10)),
          reviewedAt: new Date(Date.UTC(2026, 10, 11)),
          decision: "approved",
          feedback: "Flawless code architecture and benchmarking.",
          reviewerId: admin._id,
          reviewerName: "Admin Director",
          reviewDurationMs: 1 * 24 * 3600 * 1000,
          wasBeforeDeadline: true,
        },
      ],
    });

    // Task 2: Another high quality completed task
    const task2 = await Task.create({
      title: "Cache Layer Resilience",
      organizationId: testOrgId,
      projectId: testProjectId,
      department: "Engineering",
      assignedTo: topPerformer._id,
      assignedBy: admin._id,
      user: topPerformer._id,
      status: "completed",
      progress: 100,
      priority: "urgent",
      weight: 4,
      deadline: deadline2,
      createdAt: new Date(Date.UTC(2026, 10, 12)),
      assignedAt: new Date(Date.UTC(2026, 10, 12)),
      startedAt: new Date(Date.UTC(2026, 10, 13)),
      firstSubmittedAt: new Date(Date.UTC(2026, 10, 18)), // 2 days before deadline
      submittedAt: new Date(Date.UTC(2026, 10, 18)),
      submissionCount: 1,
      approvedAt: new Date(Date.UTC(2026, 10, 19)),
      firstAttemptApproved: true,
      isFirstSubmission: true,
      reworkCount: 0,
    });

    console.log("  ✓ PASS: Seeded 2 top-tier tasks for Alice");

    // ----------------------------------------------------------------
    // 4. Task Creation for Bob (Average Performer - Rework & Late)
    // ----------------------------------------------------------------
    console.log("\n--- 4. Task Activity Simulation: Average Performer (Bob) ---");
    const taskBob1 = await Task.create({
      title: "Design System UI Kit",
      organizationId: testOrgId,
      department: "Design",
      assignedTo: averagePerformer._id,
      assignedBy: admin._id,
      user: averagePerformer._id,
      status: "completed",
      progress: 100,
      priority: "medium",
      weight: 2,
      deadline: "2026-11-10",
      createdAt: nov2026Date,
      assignedAt: nov2026Date,
      startedAt: new Date(Date.UTC(2026, 10, 7)),
      firstSubmittedAt: new Date(Date.UTC(2026, 10, 12)), // Submitted late!
      submittedAt: new Date(Date.UTC(2026, 10, 14)),
      submissionCount: 2,
      approvedAt: new Date(Date.UTC(2026, 10, 15)),
      firstAttemptApproved: false,
      reworkCount: 1, // Required rework
    });

    const taskBob2 = await Task.create({
      title: "Landing Page Mockups",
      organizationId: testOrgId,
      department: "Design",
      assignedTo: averagePerformer._id,
      assignedBy: admin._id,
      user: averagePerformer._id,
      status: "in-progress",
      progress: 50,
      priority: "low",
      weight: 1,
      deadline: "2026-11-08", // Overdue!
      createdAt: nov2026Date,
      assignedAt: nov2026Date,
    });

    console.log("  ✓ PASS: Seeded 2 tasks for Bob (1 rework + 1 overdue)");

    // ----------------------------------------------------------------
    // 5. Automated Evaluation Calculation: Top Performer (Alice)
    // ----------------------------------------------------------------
    console.log("\n--- 5. Automated Evaluation Calculation: Alice ---");
    const aliceEval = await calculateEmployeePerformance(
      topPerformer._id,
      testOrgId,
      "month",
      2026,
      "2026-11"
    );

    console.log(`  ✓ Overall Score: ${aliceEval.overallScore}/100 (Level: ${aliceEval.performanceLevel})`);
    console.log(`  ✓ Completion Rate: ${aliceEval.metrics.taskCompletion.completionRate}%`);
    console.log(`  ✓ On-Time Rate: ${aliceEval.metrics.submissionSpeed.onTimeRate}%`);
    console.log(`  ✓ First Attempt Approval: ${aliceEval.metrics.quality.firstAttemptApprovedCount} tasks`);
    console.log(`  ✓ First Submissions: ${aliceEval.metrics.firstSubmission.comparableFirstSubmissionsCount}`);

    if (aliceEval.overallScore >= 90) {
      console.log("  ✓ PASS: Alice scored >= 90 as expected for Outstanding tier");
    } else {
      throw new Error(`Expected Outstanding score >= 90, got ${aliceEval.overallScore}`);
    }

    if (aliceEval.performanceLevel === "Outstanding") {
      console.log("  ✓ PASS: Alice classified as 'Outstanding'");
    } else {
      throw new Error(`Expected 'Outstanding', got ${aliceEval.performanceLevel}`);
    }

    // ----------------------------------------------------------------
    // 6. Automated Evaluation Calculation: Average Performer (Bob)
    // ----------------------------------------------------------------
    console.log("\n--- 6. Automated Evaluation Calculation: Bob ---");
    const bobEval = await calculateEmployeePerformance(
      averagePerformer._id,
      testOrgId,
      "month",
      2026,
      "2026-11"
    );

    console.log(`  ✓ Bob Score: ${bobEval.overallScore}/100 (Level: ${bobEval.performanceLevel})`);
    console.log(`  ✓ Bob Completion Rate: ${bobEval.metrics.taskCompletion.completionRate}%`);
    console.log(`  ✓ Bob Overdue Tasks: ${bobEval.metrics.taskCompletion.totalOverdue}`);

    if (bobEval.overallScore < aliceEval.overallScore) {
      console.log("  ✓ PASS: Alice scored higher than Bob based on real task quality, on-time rate, and completion");
    } else {
      throw new Error(`Expected Bob to score lower than Alice: Bob=${bobEval.overallScore}, Alice=${aliceEval.overallScore}`);
    }

    // ----------------------------------------------------------------
    // 7. Insufficient Data Rule Verification
    // ----------------------------------------------------------------
    console.log("\n--- 7. Insufficient Data Rule Check ---");
    const charlieEval = await calculateEmployeePerformance(
      newHireNoTasks._id,
      testOrgId,
      "month",
      2026,
      "2026-11"
    );

    if (charlieEval.hasSufficientData === false && charlieEval.performanceLevel === "Insufficient Data") {
      console.log("  ✓ PASS: Employee with 0 tasks safely classified as 'Insufficient Data' without penalty score");
    } else {
      throw new Error(`Expected Insufficient Data, got ${charlieEval.performanceLevel}`);
    }

    // ----------------------------------------------------------------
    // 8. Organization Leaderboard Ranking & Filtering
    // ----------------------------------------------------------------
    console.log("\n--- 8. Organization Leaderboard ---");
    const leaderboardResult = await calculateOrganizationLeaderboard(
      testOrgId,
      "month",
      2026,
      "2026-11"
    );

    const rank1 = leaderboardResult.leaderboard[0];
    console.log(`  ✓ Rank 1: ${rank1.employeeName} (${rank1.overallScore} pts)`);
    if (rank1.employeeEmail === topPerformer.email) {
      console.log("  ✓ PASS: Alice correctly ranked #1 on the organization leaderboard");
    } else {
      throw new Error(`Expected Alice at rank 1, got ${rank1.employeeName}`);
    }

    // Test department filter
    const designFilter = await calculateOrganizationLeaderboard(
      testOrgId,
      "month",
      2026,
      "2026-11",
      { department: "Design" }
    );
    if (designFilter.leaderboard.length === 1 && designFilter.leaderboard[0].employeeEmail === averagePerformer.email) {
      console.log("  ✓ PASS: Department filter 'Design' correctly returned only Bob");
    } else {
      throw new Error("Department filter failed");
    }

    // ----------------------------------------------------------------
    // 9. Organization Comparative Analytics
    // ----------------------------------------------------------------
    console.log("\n--- 9. Organization Comparative Analytics ---");
    const analytics = await calculateOrganizationAnalytics(
      testOrgId,
      "month",
      2026,
      "2026-11"
    );

    console.log(`  ✓ Organization Average Score: ${analytics.summary.currentAvgScore}`);
    console.log(`  ✓ Total Completed Deliverables: ${analytics.summary.currentTotalCompleted}`);
    console.log(`  ✓ Department Analytics Count: ${analytics.departmentAnalytics.length}`);
    console.log(`  ✓ Performance Reasons:`, analytics.performanceShiftReasons);

    if (analytics.summary.currentTotalCompleted >= 3 && analytics.departmentAnalytics.length >= 2) {
      console.log("  ✓ PASS: Organization analytics generated successfully with departmental breakdown");
    } else {
      throw new Error("Analytics output invalid");
    }

    // ----------------------------------------------------------------
    // 10. Admin Configuration Customization
    // ----------------------------------------------------------------
    console.log("\n--- 10. Admin Weight Customization ---");
    testOrg.performanceConfig = {
      weights: {
        taskCompletionRate: 30,
        onTimeSubmissionRate: 25,
        taskQualityFirstAttempt: 20,
        productivityConsistency: 15,
        comparableFirstSubmission: 5,
        workloadManagement: 5,
      },
      thresholds: {
        outstanding: 92,
        excellent: 82,
        veryGood: 72,
        good: 62,
        needsImprovement: 52,
      },
    };
    await testOrg.save();

    const customEval = await calculateEmployeePerformance(
      topPerformer._id,
      testOrgId,
      "month",
      2026,
      "2026-11"
    );
    if (customEval.weights.taskCompletionRate === 30 && customEval.thresholds.outstanding === 92) {
      console.log("  ✓ PASS: Custom admin weights and thresholds persisted and applied in evaluation");
    } else {
      throw new Error("Custom weights were not applied");
    }

    // ----------------------------------------------------------------
    // 11. Cleanup
    // ----------------------------------------------------------------
    console.log("\n--- 11. Cleanup ---");
    await Task.deleteMany({ organizationId: testOrgId });
    await PeriodicEvaluationSnapshot.deleteMany({ organizationId: testOrgId });
    await User.deleteMany({ organizationId: testOrgId });
    await Organization.deleteOne({ _id: testOrgId });
    console.log("  ✓ PASS: Cleaned up all test records");

    console.log("\n=================================================");
    console.log("ALL AUTOMATED PERFORMANCE EVALUATION TESTS PASSED!");
    console.log("=================================================");
  } catch (err) {
    console.error("Test failure:", err);
    // Cleanup on failure
    await Task.deleteMany({ organizationId: testOrgId });
    await PeriodicEvaluationSnapshot.deleteMany({ organizationId: testOrgId });
    await User.deleteMany({ organizationId: testOrgId });
    await Organization.deleteOne({ _id: testOrgId });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
