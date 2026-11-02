const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const Organization = require("../models/Organization");
const PeriodicEvaluationSnapshot = require("../models/PeriodicEvaluationSnapshot");

/**
 * Returns exact start and end dates, label, and previous period key for any period
 */
function getPeriodDateRange(periodType = "month", year = new Date().getFullYear(), periodValue = "") {
  const currentYear = parseInt(year, 10) || new Date().getFullYear();

  if (periodType === "month") {
    let monthIndex = new Date().getMonth(); // 0-11
    if (periodValue) {
      if (periodValue.includes("-")) {
        const parts = periodValue.split("-");
        monthIndex = parseInt(parts[1], 10) - 1;
      } else {
        monthIndex = parseInt(periodValue, 10) - 1;
      }
    }
    const safeMonth = Math.max(0, Math.min(11, monthIndex));
    const start = new Date(Date.UTC(currentYear, safeMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(currentYear, safeMonth + 1, 0, 23, 59, 59, 999));

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const valStr = `${currentYear}-${String(safeMonth + 1).padStart(2, "0")}`;
    const prevYear = safeMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = safeMonth === 0 ? 12 : safeMonth;
    const prevValStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    return {
      periodType: "month",
      year: currentYear,
      periodValue: valStr,
      periodLabel: `${monthNames[safeMonth]} ${currentYear}`,
      startDate: start,
      endDate: end,
      prevPeriodValue: prevValStr,
      prevYear,
      prevPeriodType: "month",
    };
  }

  if (periodType === "quarter") {
    let qNum = 1;
    if (periodValue) {
      const match = periodValue.match(/Q([1-4])/i);
      if (match) qNum = parseInt(match[1], 10);
      else qNum = parseInt(periodValue, 10) || 1;
    } else {
      qNum = Math.floor(new Date().getMonth() / 3) + 1;
    }
    const safeQ = Math.max(1, Math.min(4, qNum));
    const startMonth = (safeQ - 1) * 3;
    const start = new Date(Date.UTC(currentYear, startMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(currentYear, startMonth + 3, 0, 23, 59, 59, 999));

    const valStr = `${currentYear}-Q${safeQ}`;
    const prevYear = safeQ === 1 ? currentYear - 1 : currentYear;
    const prevQ = safeQ === 1 ? 4 : safeQ - 1;

    return {
      periodType: "quarter",
      year: currentYear,
      periodValue: valStr,
      periodLabel: `Q${safeQ} ${currentYear} (${getQuarterMonths(safeQ)})`,
      startDate: start,
      endDate: end,
      prevPeriodValue: `${prevYear}-Q${prevQ}`,
      prevYear,
      prevPeriodType: "quarter",
    };
  }

  if (periodType === "half-year") {
    let hNum = 1;
    if (periodValue) {
      const match = periodValue.match(/H([1-2])/i);
      if (match) hNum = parseInt(match[1], 10);
      else hNum = parseInt(periodValue, 10) || 1;
    } else {
      hNum = new Date().getMonth() < 6 ? 1 : 2;
    }
    const safeH = Math.max(1, Math.min(2, hNum));
    const startMonth = safeH === 1 ? 0 : 6;
    const start = new Date(Date.UTC(currentYear, startMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(currentYear, startMonth + 6, 0, 23, 59, 59, 999));

    const valStr = `${currentYear}-H${safeH}`;
    const prevYear = safeH === 1 ? currentYear - 1 : currentYear;
    const prevH = safeH === 1 ? 2 : 1;

    return {
      periodType: "half-year",
      year: currentYear,
      periodValue: valStr,
      periodLabel: `H${safeH} ${currentYear} (${safeH === 1 ? "Jan – Jun" : "Jul – Dec"})`,
      startDate: start,
      endDate: end,
      prevPeriodValue: `${prevYear}-H${prevH}`,
      prevYear,
      prevPeriodType: "half-year",
    };
  }

  // Yearly (default fallback)
  const start = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
  return {
    periodType: "year",
    year: currentYear,
    periodValue: `${currentYear}`,
    periodLabel: `Year ${currentYear}`,
    startDate: start,
    endDate: end,
    prevPeriodValue: `${currentYear - 1}`,
    prevYear: currentYear - 1,
    prevPeriodType: "year",
  };
}

function getQuarterMonths(q) {
  switch (q) {
    case 1: return "Jan – Mar";
    case 2: return "Apr – Jun";
    case 3: return "Jul – Sep";
    case 4: return "Oct – Dec";
    default: return "";
  }
}

/**
 * Priority weighting helper (urgent=4, high=3, medium=2, low=1)
 */
function getPriorityWeight(priority = "medium") {
  switch ((priority || "").toLowerCase()) {
    case "urgent": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 2;
  }
}

/**
 * Parse deadline string safely to Date object
 */
function parseDeadlineDate(deadlineStr) {
  if (!deadlineStr) return null;
  const d = new Date(deadlineStr);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Calculates raw employee performance for any period using underlying database task records
 */
async function calculateEmployeePerformance(employeeId, orgId, periodType = "month", year = new Date().getFullYear(), periodValue = "", customConfig = null) {
  const periodInfo = getPeriodDateRange(periodType, year, periodValue);
  const { startDate, endDate } = periodInfo;

  // Retrieve employee
  const employee = await User.findById(employeeId).lean();
  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  // Retrieve organization configuration
  let config = customConfig;
  if (!config && orgId) {
    const org = await Organization.findById(orgId).lean();
    if (org && org.performanceConfig) {
      config = org.performanceConfig;
    }
  }

  const weights = {
    taskCompletionRate: config?.weights?.taskCompletionRate ?? 25,
    onTimeSubmissionRate: config?.weights?.onTimeSubmissionRate ?? 20,
    taskQualityFirstAttempt: config?.weights?.taskQualityFirstAttempt ?? 25,
    productivityConsistency: config?.weights?.productivityConsistency ?? 15,
    comparableFirstSubmission: config?.weights?.comparableFirstSubmission ?? 5,
    workloadManagement: config?.weights?.workloadManagement ?? 10,
  };

  const thresholds = {
    outstanding: config?.thresholds?.outstanding ?? 90,
    excellent: config?.thresholds?.excellent ?? 80,
    veryGood: config?.thresholds?.veryGood ?? 70,
    good: config?.thresholds?.good ?? 60,
    needsImprovement: config?.thresholds?.needsImprovement ?? 50,
  };

  // Find all non-cancelled tasks assigned to the employee
  // A task is relevant to the period if its assignment, submission, review, completion, or activity intersects with [startDate, endDate]
  const tasks = await Task.find({
    assignedTo: employee._id,
    ...(orgId ? { organizationId: orgId } : {}),
    status: { $ne: "cancelled" },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { assignedAt: { $gte: startDate, $lte: endDate } },
      { submittedAt: { $gte: startDate, $lte: endDate } },
      { firstSubmittedAt: { $gte: startDate, $lte: endDate } },
      { approvedAt: { $gte: startDate, $lte: endDate } },
      {
        createdAt: { $lte: endDate },
        status: { $in: ["not-started", "in-progress", "submitted"] },
      },
    ],
  }).lean();

  const totalAssigned = tasks.length;

  // Rule 3: Insufficient Data check
  if (totalAssigned === 0) {
    return {
      employeeId: employee._id,
      employeeName: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
      employeeEmail: employee.email,
      department: employee.department || "General",
      designation: employee.designation || employee.role || "Specialist",
      periodType: periodInfo.periodType,
      year: periodInfo.year,
      periodValue: periodInfo.periodValue,
      periodLabel: periodInfo.periodLabel,
      startDate: periodInfo.startDate,
      endDate: periodInfo.endDate,
      hasSufficientData: false,
      overallScore: 0,
      performanceLevel: "Insufficient Data",
      trend: "stable",
      previousScore: null,
      scoreDelta: 0,
      weights,
      metrics: {
        taskCompletion: {
          totalAssigned: 0,
          totalCompleted: 0,
          totalSubmitted: 0,
          totalApproved: 0,
          totalRejected: 0,
          totalReopened: 0,
          totalPending: 0,
          totalOverdue: 0,
          completionRate: 0,
          approvalRate: 0,
          score: 0,
        },
        submissionSpeed: {
          onTimeCount: 0,
          earlyCount: 0,
          lateCount: 0,
          onTimeRate: 0,
          earlyRate: 0,
          avgTurnaroundHours: 0,
          score: 0,
        },
        consistency: {
          weeklyCompletions: [],
          activeDaysCount: 0,
          tasksPerDay: 0,
          consistencyScore: 0,
        },
        quality: {
          firstAttemptApprovedCount: 0,
          reworkTotalCount: 0,
          avgAttemptsBeforeApproval: 1,
          qualityScore: 0,
        },
        firstSubmission: {
          comparableFirstSubmissionsCount: 0,
          score: 0,
        },
        workload: {
          totalAssignedWeight: 0,
          completedWeight: 0,
          workloadScore: 0,
        },
      },
      tasksAudited: [],
      evaluatedAt: new Date(),
    };
  }

  // ==========================================
  // METRIC A: TASK COMPLETION PERFORMANCE (25%)
  // ==========================================
  let totalCompleted = 0;
  let totalSubmitted = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let totalReopened = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  let totalAssignedWeight = 0;
  let completedWeight = 0;

  // METRIC B: SUBMISSION SPEED & ON-TIME (20%)
  let onTimeCount = 0;
  let earlyCount = 0;
  let lateCount = 0;
  let deadlineEvaluatedCount = 0;
  let totalTurnaroundHours = 0;
  let turnaroundEvaluatedCount = 0;

  // METRIC C: CONSISTENCY (15%)
  const completionDates = [];
  const activeDaysSet = new Set();

  // METRIC D: TASK QUALITY & FIRST-ATTEMPT APPROVAL (25%)
  let firstAttemptApprovedCount = 0;
  let reworkTotalCount = 0;
  let totalAttemptsSum = 0;

  // METRIC E: COMPARABLE FIRST SUBMISSIONS (5%)
  let comparableFirstSubmissionsCount = 0;

  // Tasks audited audit trail
  const tasksAudited = [];

  for (const task of tasks) {
    const isCompleted = task.status === "completed";
    const isSubmitted = task.status === "submitted" || isCompleted;
    const taskPriorityWeight = getPriorityWeight(task.priority) * (task.weight || 1);
    totalAssignedWeight += taskPriorityWeight;

    if (isCompleted) {
      totalCompleted++;
      totalApproved++;
      completedWeight += taskPriorityWeight;
    }

    if (isSubmitted) {
      totalSubmitted++;
    }

    // Rework & Rejections
    const rework = task.reworkCount || 0;
    reworkTotalCount += rework;
    if (rework > 0) {
      totalReopened++;
    }

    if (task.rejectedAt || rework > 0) {
      totalRejected += rework || 1;
    }

    const attempts = Math.max(1, (task.submissionCount || 1));
    totalAttemptsSum += attempts;

    // First attempt approved check
    const isFirstAttempt = task.firstAttemptApproved || (isCompleted && rework === 0 && attempts === 1);
    if (isFirstAttempt) {
      firstAttemptApprovedCount++;
    }

    // First submission recognition
    if (task.isFirstSubmission) {
      comparableFirstSubmissionsCount++;
    }

    // Pending vs Overdue
    const deadlineDate = parseDeadlineDate(task.deadline || task.dueDate);
    const nowOrPeriodEnd = new Date() < endDate ? new Date() : endDate;

    let isOnTime = null;
    if (deadlineDate) {
      deadlineEvaluatedCount++;
      const submissionTimestamp = task.firstSubmittedAt || task.submittedAt || (isCompleted ? task.updatedAt : null);
      if (submissionTimestamp) {
        const subDate = new Date(submissionTimestamp);
        // Early: >= 24h before deadline
        if (subDate.getTime() <= deadlineDate.getTime() - 24 * 3600 * 1000) {
          earlyCount++;
          onTimeCount++;
          isOnTime = true;
        } else if (subDate.getTime() <= deadlineDate.getTime()) {
          onTimeCount++;
          isOnTime = true;
        } else {
          lateCount++;
          isOnTime = false;
        }
      } else {
        // Not yet submitted: check if overdue
        if (nowOrPeriodEnd > deadlineDate) {
          totalOverdue++;
          lateCount++;
          isOnTime = false;
        } else {
          totalPending++;
        }
      }
    } else {
      if (!isCompleted && !isSubmitted) {
        totalPending++;
      }
    }

    // Turnaround time calculation (subtracting reviewDurationMs to avoid penalizing employee for manager delays)
    if (task.submittedAt || task.firstSubmittedAt || isCompleted) {
      const assignedTime = new Date(task.assignedAt || task.createdAt).getTime();
      const submittedTime = new Date(task.firstSubmittedAt || task.submittedAt || task.updatedAt).getTime();
      const reviewDelayMs = task.reviewDurationMs || 0;
      const effectiveWorkMs = Math.max(0, (submittedTime - assignedTime) - reviewDelayMs);
      const hours = effectiveWorkMs / (1000 * 3600);
      if (hours >= 0.1 && hours <= 720) { // filter anomalies
        totalTurnaroundHours += hours;
        turnaroundEvaluatedCount++;
      }
    }

    // Work consistency date tracking
    if (isCompleted && (task.approvedAt || task.updatedAt)) {
      const cDate = new Date(task.approvedAt || task.updatedAt);
      completionDates.push(cDate);
      activeDaysSet.add(cDate.toISOString().slice(0, 10));
    } else if (task.submittedAt) {
      const sDate = new Date(task.submittedAt);
      activeDaysSet.add(sDate.toISOString().slice(0, 10));
    }

    tasksAudited.push({
      taskId: task._id,
      title: task.title,
      status: task.status,
      priority: task.priority || "medium",
      deadline: task.deadline || task.dueDate || "",
      assignedAt: task.assignedAt || task.createdAt,
      submittedAt: task.firstSubmittedAt || task.submittedAt || null,
      approvedAt: task.approvedAt || (isCompleted ? task.updatedAt : null),
      isOnTime,
      isFirstAttemptApproved: isFirstAttempt,
      isFirstSubmission: Boolean(task.isFirstSubmission),
      reworkCount: rework,
      reviewDurationHours: Number(((task.reviewDurationMs || 0) / (1000 * 3600)).toFixed(1)),
    });
  }

  // ==========================================
  // SCORE NORMALIZATION & CALCULATIONS
  // ==========================================

  // 1. Task Completion Rate & Score (Weight: 25%)
  const completionRate = totalAssigned > 0 ? Math.min(100, Math.round((totalCompleted / totalAssigned) * 100)) : 0;
  const totalReviewed = totalApproved + totalRejected;
  const approvalRate = totalReviewed > 0 ? Math.min(100, Math.round((totalApproved / totalReviewed) * 100)) : (totalCompleted > 0 ? 100 : 0);
  const overduePenalty = totalAssigned > 0 ? Math.min(30, Math.round((totalOverdue / totalAssigned) * 30)) : 0;
  const completionScore = Math.max(0, Math.min(100, completionRate - overduePenalty));

  // 2. On-Time Submission Rate & Speed Score (Weight: 20%)
  const onTimeRate = deadlineEvaluatedCount > 0 ? Math.min(100, Math.round((onTimeCount / deadlineEvaluatedCount) * 100)) : (totalCompleted > 0 ? 100 : 80);
  const earlyRate = deadlineEvaluatedCount > 0 ? Math.min(100, Math.round((earlyCount / deadlineEvaluatedCount) * 100)) : 0;
  const avgTurnaroundHours = turnaroundEvaluatedCount > 0 ? Number((totalTurnaroundHours / turnaroundEvaluatedCount).toFixed(1)) : 0;
  const speedScore = Math.min(100, Math.round(onTimeRate * 0.85 + earlyRate * 0.15));

  // 3. Productivity & Work Consistency (Weight: 15%)
  // Weekly completions distribution
  const totalWeeks = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 3600 * 1000)));
  const weeklyMap = {};
  for (let w = 1; w <= totalWeeks; w++) {
    weeklyMap[`W${w}`] = 0;
  }
  for (const cDate of completionDates) {
    const diffDays = Math.max(0, Math.floor((cDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000)));
    const wIndex = Math.min(totalWeeks, Math.floor(diffDays / 7) + 1);
    const key = `W${wIndex}`;
    weeklyMap[key] = (weeklyMap[key] || 0) + 1;
  }
  const weeklyCompletions = Object.entries(weeklyMap).map(([week, count]) => ({ week, count }));
  const activeWeeksCount = weeklyCompletions.filter((w) => w.count > 0).length;
  const activeDaysCount = activeDaysSet.size;
  const totalWorkingDays = Math.max(1, Math.round((totalWeeks * 5)));
  const tasksPerDay = totalWorkingDays > 0 ? Number((totalCompleted / totalWorkingDays).toFixed(2)) : 0;

  const weeklyCoverageRate = totalWeeks > 0 ? (activeWeeksCount / totalWeeks) * 100 : 100;
  const consistencyScore = Math.min(100, Math.round(weeklyCoverageRate * 0.70 + (onTimeRate * 0.30)));

  // 4. Task Quality & First-Attempt Approval (Weight: 25%)
  const firstAttemptApprovalRate = totalApproved > 0 ? Math.min(100, Math.round((firstAttemptApprovedCount / totalApproved) * 100)) : 100;
  const avgAttemptsBeforeApproval = totalAssigned > 0 ? Number((totalAttemptsSum / totalAssigned).toFixed(1)) : 1.0;
  const reworkPenalty = Math.min(40, reworkTotalCount * 8);
  const qualityScore = Math.max(0, Math.min(100, Math.round(firstAttemptApprovalRate * 0.80 + approvalRate * 0.20 - reworkPenalty)));

  // 5. Comparable First Submission Achievements (Weight: 5%)
  let firstSubmissionScore = 50; // neutral base
  if (comparableFirstSubmissionsCount >= 3) firstSubmissionScore = 100;
  else if (comparableFirstSubmissionsCount === 2) firstSubmissionScore = 85;
  else if (comparableFirstSubmissionsCount === 1) firstSubmissionScore = 70;

  // 6. Workload Management (Weight: 10%)
  const workloadScore = totalAssignedWeight > 0 ? Math.min(100, Math.round((completedWeight / totalAssignedWeight) * 100)) : 0;

  // Weighted Overall Composite (0 - 100)
  const overallScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (completionScore * (weights.taskCompletionRate / 100)) +
        (speedScore * (weights.onTimeSubmissionRate / 100)) +
        (qualityScore * (weights.taskQualityFirstAttempt / 100)) +
        (consistencyScore * (weights.productivityConsistency / 100)) +
        (firstSubmissionScore * (weights.comparableFirstSubmission / 100)) +
        (workloadScore * (weights.workloadManagement / 100))
      )
    )
  );

  // Performance Classification
  let performanceLevel = "Poor";
  if (overallScore >= thresholds.outstanding) performanceLevel = "Outstanding";
  else if (overallScore >= thresholds.excellent) performanceLevel = "Excellent";
  else if (overallScore >= thresholds.veryGood) performanceLevel = "Very Good";
  else if (overallScore >= thresholds.good) performanceLevel = "Good";
  else if (overallScore >= thresholds.needsImprovement) performanceLevel = "Needs Improvement";

  // Comparison with previous period
  let trend = "new";
  let previousScore = null;
  let scoreDelta = 0;

  if (periodInfo.prevPeriodValue) {
    const prevSnapshot = await PeriodicEvaluationSnapshot.findOne({
      employeeId: employee._id,
      periodType: periodInfo.prevPeriodType,
      periodValue: periodInfo.prevPeriodValue,
    }).lean();

    if (prevSnapshot && prevSnapshot.hasSufficientData) {
      previousScore = prevSnapshot.overallScore;
      scoreDelta = overallScore - previousScore;
      if (scoreDelta >= 2) trend = "improving";
      else if (scoreDelta <= -2) trend = "declining";
      else trend = "stable";
    }
  }

  const result = {
    employeeId: employee._id,
    employeeName: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
    employeeEmail: employee.email,
    department: employee.department || "General",
    designation: employee.designation || employee.role || "Specialist",
    periodType: periodInfo.periodType,
    year: periodInfo.year,
    periodValue: periodInfo.periodValue,
    periodLabel: periodInfo.periodLabel,
    startDate: periodInfo.startDate,
    endDate: periodInfo.endDate,
    hasSufficientData: true,
    overallScore,
    performanceLevel,
    trend,
    previousScore,
    scoreDelta,
    weights,
    thresholds,
    metrics: {
      taskCompletion: {
        totalAssigned,
        totalCompleted,
        totalSubmitted,
        totalApproved,
        totalRejected,
        totalReopened,
        totalPending,
        totalOverdue,
        completionRate,
        approvalRate,
        score: completionScore,
      },
      submissionSpeed: {
        onTimeCount,
        earlyCount,
        lateCount,
        onTimeRate,
        earlyRate,
        avgTurnaroundHours,
        score: speedScore,
      },
      consistency: {
        weeklyCompletions,
        activeDaysCount,
        tasksPerDay,
        consistencyScore,
      },
      quality: {
        firstAttemptApprovedCount,
        reworkTotalCount,
        avgAttemptsBeforeApproval,
        qualityScore,
      },
      firstSubmission: {
        comparableFirstSubmissionsCount,
        score: firstSubmissionScore,
      },
      workload: {
        totalAssignedWeight,
        completedWeight,
        workloadScore,
      },
    },
    tasksAudited,
    evaluatedAt: new Date(),
  };

  // Upsert historical snapshot for fast caching & auditing
  try {
    await PeriodicEvaluationSnapshot.findOneAndUpdate(
      {
        employeeId: employee._id,
        periodType: periodInfo.periodType,
        periodValue: periodInfo.periodValue,
      },
      {
        $set: {
          employeeName: result.employeeName,
          employeeEmail: result.employeeEmail,
          organizationId: orgId || null,
          companyName: employee.companyName || "",
          department: result.department,
          designation: result.designation,
          year: periodInfo.year,
          periodLabel: periodInfo.periodLabel,
          startDate: periodInfo.startDate,
          endDate: periodInfo.endDate,
          metrics: result.metrics,
          weights: result.weights,
          overallScore: result.overallScore,
          performanceLevel: result.performanceLevel,
          hasSufficientData: result.hasSufficientData,
          trend: result.trend,
          previousScore: result.previousScore,
          scoreDelta: result.scoreDelta,
          tasksAudited: result.tasksAudited,
          evaluatedAt: result.evaluatedAt,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  } catch (snapErr) {
    console.warn("Failed to save periodic snapshot:", snapErr.message);
  }

  return result;
}

/**
 * Calculates organization-wide leaderboard ranked by overall score or selected metric
 */
async function calculateOrganizationLeaderboard(orgId, periodType = "month", year = new Date().getFullYear(), periodValue = "", filters = {}, config = null) {
  // Query all active employees in organization
  const query = {
    isActivated: { $ne: false },
    role: { $ne: "superadmin" },
  };

  if (orgId) {
    query.organizationId = orgId;
  }
  if (filters.department && filters.department !== "all") {
    query.department = filters.department;
  }
  if (filters.designation && filters.designation !== "all") {
    query.designation = filters.designation;
  }
  if (filters.managerId && filters.managerId !== "all") {
    query.reportsTo = filters.managerId;
  }

  const employees = await User.find(query).select("_id firstName lastName email department designation role reportsTo hierarchyLevel employeeId").lean();

  const evaluations = [];
  for (const emp of employees) {
    try {
      const evalResult = await calculateEmployeePerformance(emp._id, orgId, periodType, year, periodValue, config);
      evaluations.push({
        ...evalResult,
        employeeIdNumber: emp.employeeId || `EMP-${emp._id.toString().slice(-4).toUpperCase()}`,
        reportsTo: emp.reportsTo,
        hierarchyLevel: emp.hierarchyLevel || 4,
      });
    } catch (e) {
      console.warn(`Evaluation error for employee ${emp._id}:`, e.message);
    }
  }

  // Sort based on requested criteria
  const sortBy = filters.sortBy || "overallScore";
  evaluations.sort((a, b) => {
    switch (sortBy) {
      case "completedTasks":
        return b.metrics.taskCompletion.totalCompleted - a.metrics.taskCompletion.totalCompleted;
      case "onTimeRate":
        return b.metrics.submissionSpeed.onTimeRate - a.metrics.submissionSpeed.onTimeRate;
      case "firstAttemptApproval":
        return b.metrics.quality.firstAttemptApprovedCount - a.metrics.quality.firstAttemptApprovedCount;
      case "firstSubmissions":
        return b.metrics.firstSubmission.comparableFirstSubmissionsCount - a.metrics.firstSubmission.comparableFirstSubmissionsCount;
      case "consistency":
        return b.metrics.consistency.consistencyScore - a.metrics.consistency.consistencyScore;
      case "greatestImprovement":
        return b.scoreDelta - a.scoreDelta;
      case "overallScore":
      default:
        // Employees with sufficient data ranked first
        if (a.hasSufficientData !== b.hasSufficientData) {
          return a.hasSufficientData ? -1 : 1;
        }
        return b.overallScore - a.overallScore;
    }
  });

  // Assign rankings (1, 2, 3...)
  evaluations.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    periodType,
    year,
    periodValue: getPeriodDateRange(periodType, year, periodValue).periodValue,
    periodLabel: getPeriodDateRange(periodType, year, periodValue).periodLabel,
    totalEmployees: evaluations.length,
    leaderboard: evaluations,
  };
}

/**
 * Calculates comparative organization performance analytics between current and prior period
 */
async function calculateOrganizationAnalytics(orgId, periodType = "month", year = new Date().getFullYear(), periodValue = "") {
  const currentPeriod = getPeriodDateRange(periodType, year, periodValue);
  const currentLeaderboard = await calculateOrganizationLeaderboard(orgId, periodType, year, currentPeriod.periodValue);

  const prevPeriod = getPeriodDateRange(
    currentPeriod.prevPeriodType,
    currentPeriod.prevYear,
    currentPeriod.prevPeriodValue
  );
  const prevLeaderboard = await calculateOrganizationLeaderboard(orgId, prevPeriod.periodType, prevPeriod.prevYear, prevPeriod.periodValue);

  // Aggregated totals
  const currentActiveEvals = currentLeaderboard.leaderboard.filter((e) => e.hasSufficientData);
  const prevActiveEvals = prevLeaderboard.leaderboard.filter((e) => e.hasSufficientData);

  const currentAvgScore = currentActiveEvals.length > 0
    ? Math.round(currentActiveEvals.reduce((sum, e) => sum + e.overallScore, 0) / currentActiveEvals.length)
    : 0;

  const prevAvgScore = prevActiveEvals.length > 0
    ? Math.round(prevActiveEvals.reduce((sum, e) => sum + e.overallScore, 0) / prevActiveEvals.length)
    : 0;

  const currentTotalCompleted = currentLeaderboard.leaderboard.reduce((sum, e) => sum + e.metrics.taskCompletion.totalCompleted, 0);
  const prevTotalCompleted = prevLeaderboard.leaderboard.reduce((sum, e) => sum + e.metrics.taskCompletion.totalCompleted, 0);

  const currentAvgOnTime = currentActiveEvals.length > 0
    ? Math.round(currentActiveEvals.reduce((sum, e) => sum + e.metrics.submissionSpeed.onTimeRate, 0) / currentActiveEvals.length)
    : 0;
  const prevAvgOnTime = prevActiveEvals.length > 0
    ? Math.round(prevActiveEvals.reduce((sum, e) => sum + e.metrics.submissionSpeed.onTimeRate, 0) / prevActiveEvals.length)
    : 0;

  const currentAvgQuality = currentActiveEvals.length > 0
    ? Math.round(currentActiveEvals.reduce((sum, e) => sum + e.metrics.quality.qualityScore, 0) / currentActiveEvals.length)
    : 0;
  const prevAvgQuality = prevActiveEvals.length > 0
    ? Math.round(prevActiveEvals.reduce((sum, e) => sum + e.metrics.quality.qualityScore, 0) / prevActiveEvals.length)
    : 0;

  // Department Breakdown
  const deptMap = {};
  for (const item of currentLeaderboard.leaderboard) {
    const d = item.department || "General";
    if (!deptMap[d]) {
      deptMap[d] = { department: d, employeeCount: 0, totalScore: 0, totalCompleted: 0, onTimeSum: 0 };
    }
    deptMap[d].employeeCount++;
    deptMap[d].totalScore += item.overallScore;
    deptMap[d].totalCompleted += item.metrics.taskCompletion.totalCompleted;
    deptMap[d].onTimeSum += item.metrics.submissionSpeed.onTimeRate;
  }

  const departmentAnalytics = Object.values(deptMap).map((d) => ({
    department: d.department,
    employeeCount: d.employeeCount,
    avgScore: Math.round(d.totalScore / d.employeeCount),
    totalCompletedTasks: d.totalCompleted,
    avgOnTimeRate: Math.round(d.onTimeSum / d.employeeCount),
  })).sort((a, b) => b.avgScore - a.avgScore);

  // Exact reasons behind performance shift
  const reasons = [];
  const scoreDiff = currentAvgScore - prevAvgScore;
  const completedDiff = currentTotalCompleted - prevTotalCompleted;
  const onTimeDiff = currentAvgOnTime - prevAvgOnTime;
  const qualityDiff = currentAvgQuality - prevAvgQuality;

  if (scoreDiff >= 2) {
    reasons.push(`Organization average score improved by +${scoreDiff} points vs ${prevPeriod.periodLabel}.`);
  } else if (scoreDiff <= -2) {
    reasons.push(`Organization average score decreased by ${scoreDiff} points vs ${prevPeriod.periodLabel}.`);
  } else {
    reasons.push(`Performance remained steady compared to ${prevPeriod.periodLabel}.`);
  }

  if (completedDiff > 0) {
    reasons.push(`Team completed +${completedDiff} more deliverables this period.`);
  } else if (completedDiff < 0) {
    reasons.push(`Deliverable volume decreased by ${Math.abs(completedDiff)} completed tasks.`);
  }

  if (onTimeDiff > 0) {
    reasons.push(`On-time delivery rate rose by +${onTimeDiff}%.`);
  } else if (onTimeDiff < 0) {
    reasons.push(`On-time delivery dipped by ${Math.abs(onTimeDiff)}%, contributing to deadline penalties.`);
  }

  if (qualityDiff > 0) {
    reasons.push(`First-attempt approval and deliverable quality improved by +${qualityDiff} points.`);
  } else if (qualityDiff < 0) {
    reasons.push(`Rework iterations and requested modifications increased (${Math.abs(qualityDiff)} pt quality shift).`);
  }

  return {
    period: currentPeriod,
    prevPeriod,
    summary: {
      currentAvgScore,
      prevAvgScore,
      scoreDiff,
      currentTotalCompleted,
      prevTotalCompleted,
      completedDiff,
      currentAvgOnTime,
      prevAvgOnTime,
      onTimeDiff,
      currentAvgQuality,
      prevAvgQuality,
      qualityDiff,
      totalEmployees: currentLeaderboard.totalEmployees,
    },
    departmentAnalytics,
    performanceShiftReasons: reasons,
    topPerformers: currentLeaderboard.leaderboard.slice(0, 5),
    mostImproved: [...currentLeaderboard.leaderboard].sort((a, b) => b.scoreDelta - a.scoreDelta).slice(0, 3),
  };
}

module.exports = {
  getPeriodDateRange,
  calculateEmployeePerformance,
  calculateOrganizationLeaderboard,
  calculateOrganizationAnalytics,
};
