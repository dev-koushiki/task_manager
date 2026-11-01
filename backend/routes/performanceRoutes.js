const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/auth");
const PerformanceRating = require("../models/PerformanceRating");
const Project = require("../models/Project");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Recognition = require("../models/Recognition");

// Helper: Check if evaluator has supervisory authority over target employee
async function canEvaluate(evaluator, targetEmployee) {
  if (!evaluator || !targetEmployee) return false;
  if (String(evaluator._id) === String(targetEmployee._id)) {
    return false; // Cannot superior-rate oneself
  }

  // Company boundaries must match
  if (evaluator.companyName !== targetEmployee.companyName) {
    return false;
  }

  // Admin / Executive Level 1 has organization-wide authority
  if (evaluator.role === "admin" || evaluator.hierarchyLevel === 1) {
    return true;
  }

  // Direct reportsTo match
  if (targetEmployee.reportsTo && String(targetEmployee.reportsTo) === String(evaluator._id)) {
    return true;
  }

  // Multi-manager reporting relationships match
  if (Array.isArray(targetEmployee.reportingRelationships)) {
    const isManager = targetEmployee.reportingRelationships.some(
      (rel) => String(rel.managerId) === String(evaluator._id) && rel.canReview !== false
    );
    if (isManager) return true;
  }

  // Superior rank (lower hierarchy number = higher tier) in same company
  const evalLevel = Number(evaluator.hierarchyLevel) || (evaluator.role === "director" ? 2 : evaluator.role === "manager" ? 3 : 4);
  const targetLevel = Number(targetEmployee.hierarchyLevel) || (targetEmployee.role === "director" ? 2 : targetEmployee.role === "manager" ? 3 : 4);

  if (evalLevel < targetLevel) {
    return true;
  }

  return false;
}

// Helper: Determine evaluator tier tag (L1, L2, L3)
function getEvaluatorTier(hierarchyLevel, role) {
  const level = Number(hierarchyLevel) || (role === "admin" ? 1 : role === "director" ? 2 : role === "manager" ? 3 : 4);
  if (level === 1) return "L1";
  if (level === 2) return "L2";
  return "L3";
}

// Helper: Secure backend formula for calculating overall rating score
function calculateOverallScore(scores) {
  const q = Math.min(5, Math.max(1, Number(scores.qualityOfWork) || 3));
  const t = Math.min(5, Math.max(1, Number(scores.timeliness) || 3));
  const i = Math.min(5, Math.max(1, Number(scores.initiative) || 3));
  const c = Math.min(5, Math.max(1, Number(scores.collaboration) || 3));

  // Secure weighted formula: Quality: 30%, Timeliness: 25%, Initiative: 25%, Collaboration: 20%
  const weighted = (q * 0.30) + (t * 0.25) + (i * 0.25) + (c * 0.20);
  return Number(Math.min(5, Math.max(1, weighted)).toFixed(2));
}

// Helper: Secure backend aggregation across hierarchy tiers
function aggregateEmployeeRatings(ratings) {
  const superiorRatings = ratings.filter(
    (r) => r.evaluationType === "superior" && r.status !== "draft"
  );

  if (superiorRatings.length === 0) {
    return {
      hasRatings: false,
      aggregateScore: 0,
      percentage: 0,
      performanceBand: "Not Rated Yet",
      categoryAverages: { qualityOfWork: 0, timeliness: 0, initiative: 0, collaboration: 0 },
      tierBreakdown: { L1: null, L2: null, L3: null },
      totalReviewsCount: 0,
      strengths: [],
      areasForImprovement: [],
    };
  }

  // Tier weights: L1 (Executive) = 40%, L2 (Dept Head/Director) = 35%, L3 (Manager/Lead) = 25%
  const tierWeights = { L1: 0.40, L2: 0.35, L3: 0.25 };
  const tierGroups = { L1: [], L2: [], L3: [] };

  for (const r of superiorRatings) {
    const tier = r.evaluatorTier || (r.evaluatorHierarchyLevel === 1 ? "L1" : r.evaluatorHierarchyLevel === 2 ? "L2" : "L3");
    if (!tierGroups[tier]) tierGroups[tier] = [];
    tierGroups[tier].push(r);
  }

  let totalWeight = 0;
  let weightedSum = 0;
  const tierBreakdown = {};

  for (const [tier, group] of Object.entries(tierGroups)) {
    if (group.length > 0) {
      const avg = group.reduce((sum, item) => sum + item.scores.overallScore, 0) / group.length;
      const weight = tierWeights[tier] || 0.25;
      totalWeight += weight;
      weightedSum += avg * weight;
      tierBreakdown[tier] = {
        count: group.length,
        average: Number(avg.toFixed(2)),
        weight: weight,
      };
    } else {
      tierBreakdown[tier] = null;
    }
  }

  const finalScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0;
  const percentage = Math.round((finalScore / 5) * 100);

  let performanceBand = "Meets Expectations";
  if (finalScore >= 4.5) performanceBand = "Outstanding";
  else if (finalScore >= 3.8) performanceBand = "Exceeds Expectations";
  else if (finalScore >= 3.0) performanceBand = "Meets Expectations";
  else performanceBand = "Needs Improvement";

  const count = superiorRatings.length;
  const categoryAverages = {
    qualityOfWork: Number((superiorRatings.reduce((s, r) => s + (r.scores.qualityOfWork || 0), 0) / count).toFixed(1)),
    timeliness: Number((superiorRatings.reduce((s, r) => s + (r.scores.timeliness || 0), 0) / count).toFixed(1)),
    initiative: Number((superiorRatings.reduce((s, r) => s + (r.scores.initiative || 0), 0) / count).toFixed(1)),
    collaboration: Number((superiorRatings.reduce((s, r) => s + (r.scores.collaboration || 0), 0) / count).toFixed(1)),
  };

  const strengths = Array.from(new Set(superiorRatings.flatMap((r) => r.strengths || []).filter(Boolean)));
  const areasForImprovement = Array.from(new Set(superiorRatings.flatMap((r) => r.areasForImprovement || []).filter(Boolean)));

  return {
    hasRatings: true,
    aggregateScore: finalScore,
    percentage,
    performanceBand,
    categoryAverages,
    tierBreakdown,
    totalReviewsCount: count,
    strengths,
    areasForImprovement,
  };
}

// Helper: Calculate milestone completion statistics for an employee
function calculateMilestoneStats(projects, employeeId) {
  const strEmpId = String(employeeId);
  const assignedMilestones = [];

  for (const project of projects) {
    if (!Array.isArray(project.milestones)) continue;
    for (const milestone of project.milestones) {
      const isAssigned = (milestone.assignedTo || []).some(
        (a) => String(a.userId) === strEmpId || String(a._id) === strEmpId
      );
      if (isAssigned) {
        assignedMilestones.push({
          ...milestone.toObject ? milestone.toObject() : milestone,
          projectId: project._id,
          projectName: project.name,
          projectDepartment: project.department,
        });
      }
    }
  }

  const now = new Date();
  const total = assignedMilestones.length;
  const completed = assignedMilestones.filter((m) => m.completed).length;
  const inProgress = assignedMilestones.filter((m) => !m.completed && m.status === "in-progress").length;
  const overdue = assignedMilestones.filter((m) => {
    if (m.completed || !m.deadline) return false;
    return new Date(m.deadline) < now;
  }).length;

  const onTimeCount = assignedMilestones.filter((m) => {
    if (!m.completed) return false;
    if (!m.deadline || !m.completedAt) return true;
    return new Date(m.completedAt) <= new Date(m.deadline);
  }).length;

  const onTimeRate = completed > 0 ? Math.round((onTimeCount / completed) * 100) : 100;

  return {
    total,
    completed,
    inProgress,
    overdue,
    onTimeRate,
    assignedMilestones,
  };
}

// ==========================================
// 1. GET /api/performance/my-progress
// Current employee's personal progress dashboard
// ==========================================
router.get("/my-progress", authMiddleware, async (req, res) => {
  try {
    const employeeId = req.user._id;
    const companyName = req.user.companyName;

    // Fetch all ratings for current employee
    const ratings = await PerformanceRating.find({
      employeeId,
      companyName,
    }).sort({ createdAt: -1 });

    const superiorRatings = ratings.filter((r) => r.evaluationType === "superior");
    const selfEvaluations = ratings.filter((r) => r.evaluationType === "self");

    // Compute backend aggregate
    const aggregate = aggregateEmployeeRatings(superiorRatings);

    // Fetch projects assigned to employee
    const allCompanyProjects = await Project.find({
      companyName,
    }).sort({ updatedAt: -1 });

    const assignedProjects = allCompanyProjects.filter((p) => {
      const isAssignedDirect = (p.assignedEmployees || []).some(
        (e) => String(e.userId) === String(employeeId)
      );
      const isAssignedMilestone = (p.milestones || []).some((m) =>
        (m.assignedTo || []).some(
          (a) => String(a.userId) === String(employeeId) || String(a._id) === String(employeeId)
        )
      );
      return isAssignedDirect || isAssignedMilestone;
    });

    const approvedProjects = assignedProjects.filter((p) => {
      if (p.status === "completed" || p.status === "approved") return true;
      const myMilestones = (p.milestones || []).filter((m) =>
        (m.assignedTo || []).some(
          (a) => String(a.userId) === String(employeeId) || String(a._id) === String(employeeId)
        )
      );
      return myMilestones.length > 0 && myMilestones.every((m) => m.completed);
    });

    const milestoneStats = calculateMilestoneStats(allCompanyProjects, employeeId);

    // Rating trends chronologically
    const trends = superiorRatings
      .slice()
      .reverse()
      .map((r) => ({
        id: r._id,
        period: r.period,
        score: r.scores.overallScore,
        tier: r.evaluatorTier,
        evaluatorName: r.evaluatorName,
        date: r.createdAt,
      }));

    // Check if current user is superior over any employees
    const potentialDirectReports = await User.find({
      companyName,
      _id: { $ne: employeeId },
      status: "active",
    });

    let directReportsCount = 0;
    for (const subordinate of potentialDirectReports) {
      if (await canEvaluate(req.user, subordinate)) {
        directReportsCount++;
      }
    }

    res.json({
      success: true,
      employee: {
        id: req.user._id,
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        designation: req.user.designation || req.user.role,
        department: req.user.department || "General",
        team: req.user.team || "",
        hierarchyLevel: req.user.hierarchyLevel || 4,
        role: req.user.role,
      },
      aggregate,
      ratings: superiorRatings,
      selfEvaluations,
      assignedProjects,
      approvedProjects,
      milestoneStats,
      trends,
      canRateOthers: directReportsCount > 0 || req.user.role === "admin" || req.user.hierarchyLevel === 1,
      directReportsCount,
    });
  } catch (error) {
    console.error("Failed to fetch my progress:", error);
    res.status(500).json({ message: "Failed to load progress data", error: error.message });
  }
});

// ==========================================
// 2. GET /api/performance/employee/:employeeId
// View performance progress of a specific employee (Authorized Superiors / Admin only)
// ==========================================
router.get("/employee/:employeeId", authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const targetEmployee = await User.findById(employeeId);

    if (!targetEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Access control check
    const isSelf = String(req.user._id) === String(targetEmployee._id);
    const hasAuthority = await canEvaluate(req.user, targetEmployee);

    if (!isSelf && !hasAuthority) {
      return res.status(403).json({
        message: "Access Denied: You are not authorized to view this employee's performance evaluations.",
      });
    }

    const companyName = targetEmployee.companyName;

    const ratings = await PerformanceRating.find({
      employeeId: targetEmployee._id,
      companyName,
    }).sort({ createdAt: -1 });

    const superiorRatings = ratings.filter((r) => r.evaluationType === "superior");
    const selfEvaluations = ratings.filter((r) => r.evaluationType === "self");
    const aggregate = aggregateEmployeeRatings(superiorRatings);

    const allCompanyProjects = await Project.find({ companyName }).sort({ updatedAt: -1 });

    const assignedProjects = allCompanyProjects.filter((p) => {
      const isAssignedDirect = (p.assignedEmployees || []).some(
        (e) => String(e.userId) === String(employeeId)
      );
      const isAssignedMilestone = (p.milestones || []).some((m) =>
        (m.assignedTo || []).some(
          (a) => String(a.userId) === String(employeeId) || String(a._id) === String(employeeId)
        )
      );
      return isAssignedDirect || isAssignedMilestone;
    });

    const approvedProjects = assignedProjects.filter((p) => {
      if (p.status === "completed" || p.status === "approved") return true;
      const myMilestones = (p.milestones || []).filter((m) =>
        (m.assignedTo || []).some(
          (a) => String(a.userId) === String(employeeId) || String(a._id) === String(employeeId)
        )
      );
      return myMilestones.length > 0 && myMilestones.every((m) => m.completed);
    });

    const milestoneStats = calculateMilestoneStats(allCompanyProjects, employeeId);

    const trends = superiorRatings
      .slice()
      .reverse()
      .map((r) => ({
        id: r._id,
        period: r.period,
        score: r.scores.overallScore,
        tier: r.evaluatorTier,
        evaluatorName: r.evaluatorName,
        date: r.createdAt,
      }));

    res.json({
      success: true,
      employee: {
        id: targetEmployee._id,
        name: `${targetEmployee.firstName} ${targetEmployee.lastName}`,
        email: targetEmployee.email,
        designation: targetEmployee.designation || targetEmployee.role,
        department: targetEmployee.department || "General",
        team: targetEmployee.team || "",
        hierarchyLevel: targetEmployee.hierarchyLevel || 4,
        role: targetEmployee.role,
      },
      aggregate,
      ratings: superiorRatings,
      selfEvaluations,
      assignedProjects,
      approvedProjects,
      milestoneStats,
      trends,
      canEvaluate: hasAuthority,
    });
  } catch (error) {
    console.error("Failed to fetch employee progress:", error);
    res.status(500).json({ message: "Failed to load employee progress", error: error.message });
  }
});

// ==========================================
// 3. GET /api/performance/direct-reports
// List employees that the caller is authorized to evaluate
// ==========================================
router.get("/direct-reports", authMiddleware, async (req, res) => {
  try {
    const companyName = req.user.companyName;

    const allEmployees = await User.find({
      companyName,
      _id: { $ne: req.user._id },
      status: "active",
    }).select("firstName lastName email role designation department team hierarchyLevel reportsTo reportingRelationships");

    const authorizedSubordinates = [];

    for (const emp of allEmployees) {
      if (await canEvaluate(req.user, emp)) {
        // Fetch latest rating for subordinate
        const latestRating = await PerformanceRating.findOne({
          employeeId: emp._id,
          companyName,
          evaluationType: "superior",
        }).sort({ createdAt: -1 });

        authorizedSubordinates.push({
          id: emp._id,
          name: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          role: emp.role,
          designation: emp.designation || emp.role,
          department: emp.department || "General",
          team: emp.team || "",
          hierarchyLevel: emp.hierarchyLevel || 4,
          latestScore: latestRating ? latestRating.scores.overallScore : null,
          latestPeriod: latestRating ? latestRating.period : null,
          hasDispute: latestRating ? latestRating.dispute?.isDisputed && latestRating.status === "disputed" : false,
        });
      }
    }

    res.json({
      success: true,
      directReports: authorizedSubordinates,
    });
  } catch (error) {
    console.error("Failed to load direct reports:", error);
    res.status(500).json({ message: "Failed to load direct reports", error: error.message });
  }
});

// ==========================================
// 4. POST /api/performance/rate
// Rate an authorized direct report (Superiors/Admin only)
// ==========================================
router.post("/rate", authMiddleware, async (req, res) => {
  try {
    const {
      employeeId,
      period,
      qualityOfWork,
      timeliness,
      initiative,
      collaboration,
      strengths,
      areasForImprovement,
      comments,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Target employeeId is required" });
    }

    const targetEmployee = await User.findById(employeeId);
    if (!targetEmployee) {
      return res.status(404).json({ message: "Target employee not found" });
    }

    // Security & Access Control: Verify caller has authority
    const authorized = await canEvaluate(req.user, targetEmployee);
    if (!authorized) {
      return res.status(403).json({
        message: "Security Violation: You are not authorized to evaluate this employee. Subordinates cannot rate superiors or unauthorized peers.",
      });
    }

    // Calculate score breakdown securely on backend
    const scores = {
      qualityOfWork: Number(qualityOfWork) || 3,
      timeliness: Number(timeliness) || 3,
      initiative: Number(initiative) || 3,
      collaboration: Number(collaboration) || 3,
    };
    scores.overallScore = calculateOverallScore(scores);

    const evaluatorTier = getEvaluatorTier(req.user.hierarchyLevel, req.user.role);

    const ratingPeriod = period && period.trim() ? period.trim() : (() => {
      const d = new Date();
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      return `Q${quarter} ${d.getFullYear()}`;
    })();

    const initialAudit = {
      action: "created",
      performedBy: req.user._id,
      performedByName: `${req.user.firstName} ${req.user.lastName}`,
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: `Submitted ${evaluatorTier} rating for ${ratingPeriod} with overall score ${scores.overallScore}`,
    };

    const newRating = new PerformanceRating({
      employeeId: targetEmployee._id,
      employeeName: `${targetEmployee.firstName} ${targetEmployee.lastName}`,
      employeeDesignation: targetEmployee.designation || targetEmployee.role,
      organizationId: req.user.organizationId || null,
      companyName: req.user.companyName,
      evaluatorId: req.user._id,
      evaluatorName: `${req.user.firstName} ${req.user.lastName}`,
      evaluatorRole: req.user.role,
      evaluatorHierarchyLevel: req.user.hierarchyLevel || (req.user.role === "admin" ? 1 : 2),
      evaluatorTier,
      evaluationType: "superior",
      period: ratingPeriod,
      scores,
      strengths: Array.isArray(strengths) ? strengths.filter(Boolean) : [],
      areasForImprovement: Array.isArray(areasForImprovement) ? areasForImprovement.filter(Boolean) : [],
      comments: comments || "",
      status: "published",
      auditTrail: [initialAudit],
    });

    await newRating.save();

    // Notify employee of new rating
    try {
      await Notification.create({
        userId: targetEmployee._id,
        organizationId: req.user.organizationId || targetEmployee.organizationId || new mongoose.Types.ObjectId(),
        type: "rating_submitted",
        title: "New Performance Rating Received",
        message: `${req.user.firstName} ${req.user.lastName} submitted a ${evaluatorTier} performance rating (${scores.overallScore} / 5.0) for ${ratingPeriod}.`,
        link: "/dashboard?tab=my_progress",
      });
    } catch (notifErr) {
      console.warn("Notification dispatch warning:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Performance rating submitted successfully",
      rating: newRating,
    });
  } catch (error) {
    console.error("Failed to submit rating:", error);
    res.status(500).json({ message: "Failed to submit rating", error: error.message });
  }
});

// ==========================================
// 5. POST /api/performance/self-eval
// Submit employee self-evaluation
// ==========================================
router.post("/self-eval", authMiddleware, async (req, res) => {
  try {
    const {
      period,
      qualityOfWork,
      timeliness,
      initiative,
      collaboration,
      strengths,
      areasForImprovement,
      comments,
    } = req.body;

    const scores = {
      qualityOfWork: Number(qualityOfWork) || 3,
      timeliness: Number(timeliness) || 3,
      initiative: Number(initiative) || 3,
      collaboration: Number(collaboration) || 3,
    };
    scores.overallScore = calculateOverallScore(scores);

    const ratingPeriod = period && period.trim() ? period.trim() : (() => {
      const d = new Date();
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      return `Q${quarter} ${d.getFullYear()}`;
    })();

    const selfAudit = {
      action: "created",
      performedBy: req.user._id,
      performedByName: `${req.user.firstName} ${req.user.lastName}`,
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: `Submitted Self-Evaluation for ${ratingPeriod}`,
    };

    const selfEval = new PerformanceRating({
      employeeId: req.user._id,
      employeeName: `${req.user.firstName} ${req.user.lastName}`,
      employeeDesignation: req.user.designation || req.user.role,
      organizationId: req.user.organizationId || null,
      companyName: req.user.companyName,
      evaluatorId: req.user._id,
      evaluatorName: `${req.user.firstName} ${req.user.lastName}`,
      evaluatorRole: req.user.role,
      evaluatorHierarchyLevel: req.user.hierarchyLevel || 4,
      evaluatorTier: "Self",
      evaluationType: "self",
      period: ratingPeriod,
      scores,
      strengths: Array.isArray(strengths) ? strengths.filter(Boolean) : [],
      areasForImprovement: Array.isArray(areasForImprovement) ? areasForImprovement.filter(Boolean) : [],
      comments: comments || "",
      status: "published",
      auditTrail: [selfAudit],
    });

    await selfEval.save();

    res.status(201).json({
      success: true,
      message: "Self-evaluation submitted successfully",
      selfEvaluation: selfEval,
    });
  } catch (error) {
    console.error("Failed to submit self-evaluation:", error);
    res.status(500).json({ message: "Failed to submit self-evaluation", error: error.message });
  }
});

// ==========================================
// 6. POST /api/performance/dispute
// Dispute or request review of a rating
// ==========================================
router.post("/dispute", authMiddleware, async (req, res) => {
  try {
    const { ratingId, reason, employeeNotes } = req.body;

    if (!ratingId || !reason) {
      return res.status(400).json({ message: "ratingId and reason are required" });
    }

    const rating = await PerformanceRating.findById(ratingId);
    if (!rating) {
      return res.status(404).json({ message: "Rating record not found" });
    }

    // Security: Only the evaluated employee can dispute their own rating
    if (String(rating.employeeId) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only dispute your own performance ratings." });
    }

    rating.status = "disputed";
    rating.dispute = {
      isDisputed: true,
      disputedAt: new Date(),
      reason: reason.trim(),
      employeeNotes: employeeNotes ? employeeNotes.trim() : "",
      resolutionStatus: "pending",
      resolutionNotes: "",
      resolvedBy: null,
      resolvedByName: "",
      resolvedAt: null,
    };

    rating.auditTrail.push({
      action: "disputed",
      performedBy: req.user._id,
      performedByName: `${req.user.firstName} ${req.user.lastName}`,
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: `Rating review requested. Reason: ${reason}`,
    });

    await rating.save();

    // Notify evaluator
    try {
      await Notification.create({
        userId: rating.evaluatorId,
        organizationId: rating.organizationId || new mongoose.Types.ObjectId(),
        type: "rating_disputed",
        title: "Rating Dispute / Review Requested",
        message: `${req.user.firstName} ${req.user.lastName} requested a review on their ${rating.period} performance rating.`,
        link: "/dashboard?tab=my_progress",
      });
    } catch (notifErr) {
      console.warn("Dispute notification warning:", notifErr.message);
    }

    res.json({
      success: true,
      message: "Dispute / review request submitted successfully",
      rating,
    });
  } catch (error) {
    console.error("Failed to submit dispute:", error);
    res.status(500).json({ message: "Failed to dispute rating", error: error.message });
  }
});

// ==========================================
// 7. POST /api/performance/resolve-dispute
// Resolve a rating dispute (Evaluator / Admin / Superior only)
// ==========================================
router.post("/resolve-dispute", authMiddleware, async (req, res) => {
  try {
    const { ratingId, resolutionStatus, resolutionNotes, adjustedScores } = req.body;

    if (!ratingId || !resolutionStatus) {
      return res.status(400).json({ message: "ratingId and resolutionStatus are required" });
    }

    const rating = await PerformanceRating.findById(ratingId);
    if (!rating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    // Security: Only evaluator, admin, or superior can resolve
    const isEvaluator = String(rating.evaluatorId) === String(req.user._id);
    const isAdmin = req.user.role === "admin" || req.user.hierarchyLevel === 1;

    if (!isEvaluator && !isAdmin) {
      return res.status(403).json({ message: "Unauthorized: Only the evaluator or an administrator can resolve this dispute." });
    }

    const previousScores = { ...rating.scores.toObject() };

    if (resolutionStatus === "adjusted" && adjustedScores) {
      rating.scores.qualityOfWork = Number(adjustedScores.qualityOfWork) || rating.scores.qualityOfWork;
      rating.scores.timeliness = Number(adjustedScores.timeliness) || rating.scores.timeliness;
      rating.scores.initiative = Number(adjustedScores.initiative) || rating.scores.initiative;
      rating.scores.collaboration = Number(adjustedScores.collaboration) || rating.scores.collaboration;
      rating.scores.overallScore = calculateOverallScore(rating.scores);
    }

    rating.status = "resolved";
    rating.dispute.resolutionStatus = resolutionStatus;
    rating.dispute.resolutionNotes = resolutionNotes || "";
    rating.dispute.resolvedBy = req.user._id;
    rating.dispute.resolvedByName = `${req.user.firstName} ${req.user.lastName}`;
    rating.dispute.resolvedAt = new Date();

    rating.auditTrail.push({
      action: "resolved",
      performedBy: req.user._id,
      performedByName: `${req.user.firstName} ${req.user.lastName}`,
      performedByRole: req.user.role,
      timestamp: new Date(),
      details: `Dispute resolved as ${resolutionStatus}. ${resolutionNotes || ""}`,
      previousScores: resolutionStatus === "adjusted" ? previousScores : null,
    });

    await rating.save();

    // Notify employee of resolution
    try {
      await Notification.create({
        userId: rating.employeeId,
        organizationId: rating.organizationId || new mongoose.Types.ObjectId(),
        type: "dispute_resolved",
        title: "Rating Dispute Resolved",
        message: `Your dispute on the ${rating.period} rating was marked ${resolutionStatus} by ${req.user.firstName} ${req.user.lastName}.`,
        link: "/dashboard?tab=my_progress",
      });
    } catch (notifErr) {
      console.warn("Resolution notification warning:", notifErr.message);
    }

    res.json({
      success: true,
      message: `Dispute resolved as ${resolutionStatus}`,
      rating,
    });
  } catch (error) {
    console.error("Failed to resolve dispute:", error);
    res.status(500).json({ message: "Failed to resolve dispute", error: error.message });
  }
});

// ==========================================
// 8. POST /api/performance/milestone-note
// Add progress notes to a project milestone
// ==========================================
router.post("/milestone-note", authMiddleware, async (req, res) => {
  try {
    const { projectId, milestoneId, note } = req.body;

    if (!projectId || !milestoneId || !note || !note.trim()) {
      return res.status(400).json({ message: "projectId, milestoneId, and note are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const milestone = project.milestones.find((m) => String(m.id || m._id) === String(milestoneId));
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found in this project" });
    }

    if (!Array.isArray(milestone.progressNotes)) {
      milestone.progressNotes = [];
    }

    const newNote = {
      id: new mongoose.Types.ObjectId().toString(),
      authorId: req.user._id,
      authorName: `${req.user.firstName} ${req.user.lastName}`,
      authorRole: req.user.role,
      note: note.trim(),
      createdAt: new Date(),
    };

    milestone.progressNotes.push(newNote);
    await project.save();

    // Notify project director or assignees if appropriate
    if (project.directorId && String(project.directorId) !== String(req.user._id)) {
      try {
        await Notification.create({
          userId: project.directorId,
          organizationId: project.organizationId || new mongoose.Types.ObjectId(),
          type: "progress_note_added",
          title: "Milestone Progress Note Added",
          message: `${req.user.firstName} ${req.user.lastName} added a note on milestone "${milestone.title}".`,
          link: `/dashboard?tab=my_progress`,
        });
      } catch (notifErr) {
        console.warn("Progress note notification error:", notifErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: "Progress note added successfully",
      note: newNote,
      milestone,
    });
  } catch (error) {
    console.error("Failed to add milestone note:", error);
    res.status(500).json({ message: "Failed to add milestone note", error: error.message });
  }
});

// ==========================================
// 9. GET /api/performance/recognition/nominees
// Calculate Employee of the Month / Year nominees using multi-metric formula
// (Ratings 40%, Quality 25%, Delivery 20%, Initiative/Collab 15%)
// ==========================================
router.get("/recognition/nominees", authMiddleware, async (req, res) => {
  try {
    const { period, type = "month" } = req.query;
    const companyName = req.user.companyName;

    const defaultPeriod = type === "year"
      ? `${new Date().getFullYear()}`
      : new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

    const activePeriod = period && period.trim() ? period.trim() : defaultPeriod;

    // Check if award already approved for this period
    const existingAward = await Recognition.findOne({
      companyName,
      type,
      period: activePeriod,
    });

    // Fetch all non-admin employees in company
    const candidates = await User.find({
      companyName,
      role: { $ne: "admin" },
      hierarchyLevel: { $gt: 1 },
      status: "active",
    }).select("firstName lastName email designation department team hierarchyLevel employeeId");

    const allProjects = await Project.find({ companyName });
    const nominees = [];

    for (const emp of candidates) {
      const empRatings = await PerformanceRating.find({
        employeeId: emp._id,
        companyName,
        evaluationType: "superior",
        status: { $ne: "draft" },
      });

      // Metric 1: Superior Rating Average (0-5)
      const ratingScore = empRatings.length > 0
        ? empRatings.reduce((sum, r) => sum + r.scores.overallScore, 0) / empRatings.length
        : 3.0; // default baseline

      // Metric 2: Quality of Work (0-5)
      const qualityScore = empRatings.length > 0
        ? empRatings.reduce((sum, r) => sum + (r.scores.qualityOfWork || 3), 0) / empRatings.length
        : 3.0;

      // Metric 3: Project Delivery & On-Time Rate (0-5)
      const stats = calculateMilestoneStats(allProjects, emp._id);
      const deliveryScore = Number(((stats.onTimeRate / 100) * 5).toFixed(2));

      // Metric 4: Initiative & Collaboration (0-5)
      const initiativeScore = empRatings.length > 0
        ? empRatings.reduce((sum, r) => sum + (((r.scores.initiative || 3) + (r.scores.collaboration || 3)) / 2), 0) / empRatings.length
        : 3.0;

      // Multi-metric Composite Score (0-100)
      // Never based solely on raw number of completed tasks!
      const compositeRaw = (ratingScore * 0.40) + (qualityScore * 0.25) + (deliveryScore * 0.20) + (initiativeScore * 0.15);
      const compositeScore = Math.round(compositeRaw * 20); // Scale to 100%

      nominees.push({
        id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        employeeIdNumber: emp.employeeId || `EMP-${emp._id.toString().slice(-4).toUpperCase()}`,
        designation: emp.designation || "Specialist",
        department: emp.department || "General",
        hierarchyLevel: emp.hierarchyLevel || 4,
        metrics: {
          ratingScore: Number(ratingScore.toFixed(2)),
          qualityScore: Number(qualityScore.toFixed(2)),
          deliveryScore: Number(deliveryScore.toFixed(2)),
          initiativeScore: Number(initiativeScore.toFixed(2)),
          onTimeRate: stats.onTimeRate,
          completedMilestones: stats.completed,
          compositeScore,
        },
      });
    }

    // Rank highest composite score first
    nominees.sort((a, b) => b.metrics.compositeScore - a.metrics.compositeScore);

    res.json({
      success: true,
      type,
      period: activePeriod,
      nominees,
      existingAward,
    });
  } catch (error) {
    console.error("Failed to calculate nominees:", error);
    res.status(500).json({ message: "Failed to calculate recognition nominees", error: error.message });
  }
});

// ==========================================
// 10. GET /api/performance/recognition/awards
// List all approved recognition awards
// ==========================================
router.get("/recognition/awards", authMiddleware, async (req, res) => {
  try {
    const companyName = req.user.companyName;

    const awards = await Recognition.find({
      companyName,
      status: { $in: ["approved", "published"] },
    }).sort({ createdAt: -1 });

    const myAwards = awards.filter((a) => String(a.employeeId) === String(req.user._id));

    res.json({
      success: true,
      awards,
      myAwards,
    });
  } catch (error) {
    console.error("Failed to load recognition awards:", error);
    res.status(500).json({ message: "Failed to load recognition awards", error: error.message });
  }
});

// ==========================================
// 11. POST /api/performance/recognition/approve
// Admin reviews, approves, and issues recognition award
// ==========================================
router.post("/recognition/approve", authMiddleware, async (req, res) => {
  try {
    const {
      employeeId,
      type,
      period,
      title,
      customComment,
      employeePhoto,
      employeeIdNumber,
    } = req.body;

    // Security: Only Admin or Level 1 Executive can approve official recognition
    if (req.user.role !== "admin" && req.user.hierarchyLevel !== 1) {
      return res.status(403).json({
        message: "Access Denied: Only authorized administrators can review and approve recognition awards.",
      });
    }

    if (!employeeId || !type || !period) {
      return res.status(400).json({ message: "employeeId, type, and period are required" });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Target employee not found" });
    }

    const awardTitle = title && title.trim()
      ? title.trim()
      : type === "year"
      ? `Employee of the Year – ${period}`
      : `Employee of the Month – ${period}`;

    // Calculate official criteria scores
    const empRatings = await PerformanceRating.find({
      employeeId: employee._id,
      companyName: req.user.companyName,
      evaluationType: "superior",
    });
    const allProjects = await Project.find({ companyName: req.user.companyName });
    const stats = calculateMilestoneStats(allProjects, employee._id);

    const ratingScore = empRatings.length > 0
      ? empRatings.reduce((sum, r) => sum + r.scores.overallScore, 0) / empRatings.length
      : 4.5;
    const qualityScore = empRatings.length > 0
      ? empRatings.reduce((sum, r) => sum + (r.scores.qualityOfWork || 4), 0) / empRatings.length
      : 4.5;
    const deliveryScore = Number(((stats.onTimeRate / 100) * 5).toFixed(2));
    const initiativeScore = empRatings.length > 0
      ? empRatings.reduce((sum, r) => sum + (((r.scores.initiative || 4) + (r.scores.collaboration || 4)) / 2), 0) / empRatings.length
      : 4.5;
    const compositeScore = Math.round(((ratingScore * 0.40) + (qualityScore * 0.25) + (deliveryScore * 0.20) + (initiativeScore * 0.15)) * 20);

    const newAward = new Recognition({
      employeeId: employee._id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeIdNumber: employeeIdNumber || employee.employeeId || `EMP-${employee._id.toString().slice(-4).toUpperCase()}`,
      employeePhoto: employeePhoto || "",
      employeeDesignation: employee.designation || employee.role,
      department: employee.department || "General",
      organizationId: req.user.organizationId || employee.organizationId || null,
      companyName: req.user.companyName,
      type,
      title: awardTitle,
      period,
      criteriaScores: {
        ratingScore: Number(ratingScore.toFixed(2)),
        qualityScore: Number(qualityScore.toFixed(2)),
        deliveryScore: Number(deliveryScore.toFixed(2)),
        initiativeScore: Number(initiativeScore.toFixed(2)),
        compositeScore,
      },
      customComment: customComment || "Awarded in recognition of distinguished performance, strategic initiative, and outstanding delivery.",
      status: "approved",
      approvedBy: req.user._id,
      approvedByName: `${req.user.firstName} ${req.user.lastName}`,
      approvedAt: new Date(),
    });

    await newAward.save();

    // Dispatch congratulatory notification
    try {
      await Notification.create({
        userId: employee._id,
        organizationId: req.user.organizationId || employee.organizationId || new mongoose.Types.ObjectId(),
        type: "recognition_awarded",
        title: `🏆 Congratulations! You won ${awardTitle}`,
        message: `${req.user.firstName} ${req.user.lastName} officially awarded you ${awardTitle}. Download your official certificate from My Progress!`,
        link: "/dashboard?tab=my_progress",
      });
    } catch (notifErr) {
      console.warn("Recognition notification error:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Recognition award '${awardTitle}' approved and issued successfully.`,
      award: newAward,
    });
  } catch (error) {
    console.error("Failed to approve recognition:", error);
    res.status(500).json({ message: "Failed to approve recognition", error: error.message });
  }
});

// ==========================================
// 12. POST /api/performance/recognition/certificate
// Save generated certificate URLs (PDF / PNG)
// ==========================================
router.post("/recognition/certificate", authMiddleware, async (req, res) => {
  try {
    const { awardId, certificatePdfUrl, certificatePngUrl } = req.body;

    if (!awardId) {
      return res.status(400).json({ message: "awardId is required" });
    }

    const award = await Recognition.findById(awardId);
    if (!award) {
      return res.status(404).json({ message: "Award record not found" });
    }

    if (certificatePdfUrl) award.certificatePdfUrl = certificatePdfUrl;
    if (certificatePngUrl) award.certificatePngUrl = certificatePngUrl;
    await award.save();

    res.json({
      success: true,
      message: "Certificate stored successfully",
      award,
    });
  } catch (error) {
    console.error("Failed to save certificate:", error);
    res.status(500).json({ message: "Failed to save certificate", error: error.message });
  }
});

module.exports = router;
