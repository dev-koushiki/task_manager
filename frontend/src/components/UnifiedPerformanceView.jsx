import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUpIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  StarIcon,
  AwardIcon,
  ShieldIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  MessageSquareIcon,
  CheckSquareIcon,
  CalendarIcon,
  SparklesIcon,
  UsersIcon,
  DownloadIcon,
  SettingsIcon,
  BarChartIcon,
  UserIcon,
  FileTextIcon,
  FilterIcon,
  XIcon,
} from './Icons';
import { api } from '../services/api';
import { CertificateModal } from './CertificateModal';

export const UnifiedPerformanceView = ({
  user,
  isAdmin = false,
  selectedEmployeeId = null,
  onOpenDirectory = null,
}) => {
  // Determine user permissions and hierarchy roles dynamically
  const userRole = (user?.role || 'employee').toLowerCase();
  const userDept = (user?.department || '').toLowerCase();
  const userDesig = (user?.designation || user?.positionTitle || '').toLowerCase();
  const perms = user?.permissions || {};
  const hasEmployeeMgmt = Boolean(perms.canManageEmployees);

  const isSupervisorOrManager =
    isAdmin ||
    userRole === 'director' ||
    userRole === 'manager' ||
    Boolean(hasEmployeeMgmt || perms.canAssignTasks || perms.canRateOthers);

  const isAuthorizedHR =
    isAdmin ||
    userRole === 'admin' ||
    userRole === 'hr' ||
    user?.hierarchyLevel === 1 ||
    hasEmployeeMgmt ||
    userDept.includes('human resources') ||
    userDept === 'hr' ||
    userDept.includes('hr &') ||
    /\bhr\b/.test(userDesig) ||
    userDesig.includes('human resources');

  // Active Main Subtab Navigation
  // 1: overview | 2: work-progress | 3: scorecard | 4: reviews | 5: self-eval
  // 6: recognition | 7: team | 8: audited-tasks | 9: analytics | 10: settings
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Reporting Period & Date Filtering State
  // 'this-month' | 'last-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'custom'
  const [dateRangeFilter, setDateRangeFilter] = useState('this-month');
  const [periodType, setPeriodType] = useState('month');
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodValue, setPeriodValue] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // General Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Personal & Inspected Employee Data
  const [activeEmployeeId, setActiveEmployeeId] = useState(selectedEmployeeId || user?._id);
  const [progressData, setProgressData] = useState(null);
  const [individualEval, setIndividualEval] = useState(null);

  // Managerial / Direct Reports State
  const [directReports, setDirectReports] = useState([]);
  const [inspectedSubordinate, setInspectedSubordinate] = useState(null);
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState('all');

  // Recognition & Awards State
  const [awards, setAwards] = useState([]);
  const [nomineesData, setNomineesData] = useState(null);
  const [nomineePeriodType, setNomineePeriodType] = useState('month');
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certModalData, setCertModalData] = useState({});

  // Organization Analytics & Leaderboard State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardSort, setLeaderboardSort] = useState('overallScore');
  const [analyticsDeptFilter, setAnalyticsDeptFilter] = useState('all');

  // Audited Tasks State
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('all');

  // Modals & Action Forms State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [targetEmployeeForRate, setTargetEmployeeForRate] = useState(null);
  const [rateForm, setRateForm] = useState({
    period: '',
    qualityOfWork: 4,
    timeliness: 4,
    initiative: 4,
    collaboration: 4,
    strengthsText: '',
    areasText: '',
    comments: '',
  });

  const [isSelfEvalModalOpen, setIsSelfEvalModalOpen] = useState(false);
  const [selfEvalForm, setSelfEvalForm] = useState({
    period: '',
    qualityOfWork: 4,
    timeliness: 4,
    initiative: 4,
    collaboration: 4,
    strengthsText: '',
    areasText: '',
    comments: '',
  });

  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [activeRatingForDispute, setActiveRatingForDispute] = useState(null);
  const [disputeForm, setDisputeForm] = useState({
    reason: 'Score discrepancy based on delivered deliverables',
    employeeNotes: '',
  });

  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [activeDisputeRating, setActiveDisputeRating] = useState(null);
  const [resolveForm, setResolveForm] = useState({
    resolutionStatus: 'reviewed',
    resolutionNotes: '',
    adjustScores: false,
    qualityOfWork: 4,
    timeliness: 4,
    initiative: 4,
    collaboration: 4,
  });

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [activeMilestoneForNote, setActiveMilestoneForNote] = useState(null);
  const [noteForm, setNoteForm] = useState({ note: '' });

  // Admin Config State
  const [weightsConfig, setWeightsConfig] = useState({
    taskCompletionRate: 25,
    onTimeSubmissionRate: 20,
    taskQualityFirstAttempt: 25,
    productivityConsistency: 15,
    comparableFirstSubmission: 5,
    workloadManagement: 10,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMessage, setConfigSuccessMessage] = useState('');

  // Handle Date Filter Change
  const handleDateFilterChange = (rangeKey) => {
    setDateRangeFilter(rangeKey);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    if (rangeKey === 'this-month') {
      setPeriodType('month');
      setYear(curYear);
      setPeriodValue(String(curMonth).padStart(2, '0'));
    } else if (rangeKey === 'last-month') {
      setPeriodType('month');
      if (curMonth === 1) {
        setYear(curYear - 1);
        setPeriodValue('12');
      } else {
        setYear(curYear);
        setPeriodValue(String(curMonth - 1).padStart(2, '0'));
      }
    } else if (rangeKey === 'last-3-months') {
      setPeriodType('quarter');
      setYear(curYear);
      const q = Math.ceil(curMonth / 3);
      setPeriodValue(`Q${q}`);
    } else if (rangeKey === 'last-6-months') {
      setPeriodType('half');
      setYear(curYear);
      setPeriodValue(curMonth <= 6 ? 'H1' : 'H2');
    } else if (rangeKey === 'this-year') {
      setPeriodType('year');
      setYear(curYear);
      setPeriodValue('');
    }
  };

  // Synchronize when selectedEmployeeId changes externally
  useEffect(() => {
    if (selectedEmployeeId) {
      setActiveEmployeeId(selectedEmployeeId);
      setActiveSubTab('scorecard');
    }
  }, [selectedEmployeeId]);

  // Load All Primary Data
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError('');

      const queryParams = {
        periodType,
        year,
        periodValue,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };

      // 1. Load Personal Progress Data
      const pData = await api.getMyProgress();
      setProgressData(pData);

      // 2. Load Scorecard Evaluation Data
      const targetEmp = activeEmployeeId || user?._id;
      if (targetEmp) {
        try {
          const evalRes = await api.getEmployeePerformanceEvaluation(targetEmp, queryParams);
          if (evalRes && evalRes.evaluation) {
            setIndividualEval(evalRes.evaluation);
          }
        } catch (e) {
          console.warn('Scorecard evaluation load warning:', e.message);
        }
      }

      // 3. Load Recognition Awards & Nominees
      try {
        const awardsRes = await api.getRecognitionAwards();
        setAwards(awardsRes.awards || []);
      } catch (e) {
        console.warn('Awards load warning:', e.message);
      }

      // 4. Load Direct Reports (if supervisor or admin)
      if (isSupervisorOrManager || pData?.canRateOthers) {
        try {
          const reports = await api.getDirectReports();
          setDirectReports(Array.isArray(reports) ? reports : []);
          const nomRes = await api.getRecognitionNominees('', nomineePeriodType);
          setNomineesData(nomRes);
        } catch (e) {
          console.warn('Direct reports load warning:', e.message);
        }
      }

      // 5. Load Organization Analytics & Leaderboard (if admin or supervisor)
      if (isAdmin || isSupervisorOrManager) {
        try {
          const aRes = await api.getPerformanceAnalytics(queryParams);
          if (aRes && aRes.analytics) {
            setAnalyticsData(aRes.analytics);
          }
        } catch (e) {
          console.warn('Analytics load warning:', e.message);
        }

        try {
          const lRes = await api.getPerformanceLeaderboard({
            ...queryParams,
            sortBy: leaderboardSort,
            department: analyticsDeptFilter,
          });
          if (lRes && lRes.leaderboard) {
            setLeaderboardData(lRes.leaderboard);
          }
        } catch (e) {
          console.warn('Leaderboard load warning:', e.message);
        }

        try {
          const cfgRes = await api.getPerformanceConfig();
          if (cfgRes && cfgRes.weights) {
            setWeightsConfig(cfgRes.weights);
          }
        } catch (e) {
          console.warn('Config load warning:', e.message);
        }
      }
    } catch (err) {
      console.error('Failed to load unified performance data:', err);
      setError(err.message || 'Failed to load performance metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [periodType, year, periodValue, activeEmployeeId, nomineePeriodType, leaderboardSort, analyticsDeptFilter]);

  // Inspect Subordinate Helper
  const handleInspectSubordinate = async (sub) => {
    try {
      setLoading(true);
      setInspectedSubordinate(sub);
      setActiveEmployeeId(sub._id || sub.id);
      const subProg = await api.getEmployeeProgress(sub._id || sub.id);
      setProgressData(subProg);
      const subEval = await api.getEmployeePerformanceEvaluation(sub._id || sub.id, {
        periodType,
        year,
        periodValue,
      });
      if (subEval && subEval.evaluation) {
        setIndividualEval(subEval.evaluation);
      }
      setActiveSubTab('scorecard');
    } catch (err) {
      alert(`Could not load subordinate details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset Inspection back to personal user profile
  const handleResetToSelf = () => {
    setInspectedSubordinate(null);
    setActiveEmployeeId(user?._id);
    loadAllData();
  };

  // Submit Performance Rating
  const handleRateSubmit = async (e) => {
    e.preventDefault();
    if (!targetEmployeeForRate) return;
    try {
      await api.submitPerformanceRating({
        employeeId: targetEmployeeForRate._id || targetEmployeeForRate.id,
        period: rateForm.period || `${year}-${periodValue || 'M'}`,
        qualityOfWork: Number(rateForm.qualityOfWork),
        timeliness: Number(rateForm.timeliness),
        initiative: Number(rateForm.initiative),
        collaboration: Number(rateForm.collaboration),
        strengths: rateForm.strengthsText.split(',').map((s) => s.trim()).filter(Boolean),
        areasForImprovement: rateForm.areasText.split(',').map((s) => s.trim()).filter(Boolean),
        comments: rateForm.comments,
      });
      setIsRateModalOpen(false);
      setRateForm({
        period: '',
        qualityOfWork: 4,
        timeliness: 4,
        initiative: 4,
        collaboration: 4,
        strengthsText: '',
        areasText: '',
        comments: '',
      });
      await loadAllData();
      alert('Supervisor evaluation submitted successfully!');
    } catch (err) {
      alert(`Failed to submit rating: ${err.message}`);
    }
  };

  // Submit Self-Evaluation
  const handleSelfEvalSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.submitSelfEvaluation({
        period: selfEvalForm.period || `${year}-${periodValue || 'M'}`,
        qualityOfWork: Number(selfEvalForm.qualityOfWork),
        timeliness: Number(selfEvalForm.timeliness),
        initiative: Number(selfEvalForm.initiative),
        collaboration: Number(selfEvalForm.collaboration),
        strengths: selfEvalForm.strengthsText.split(',').map((s) => s.trim()).filter(Boolean),
        areasForImprovement: selfEvalForm.areasText.split(',').map((s) => s.trim()).filter(Boolean),
        comments: selfEvalForm.comments,
      });
      setIsSelfEvalModalOpen(false);
      await loadAllData();
      alert('Self-evaluation submitted successfully!');
    } catch (err) {
      alert(`Failed to submit self-evaluation: ${err.message}`);
    }
  };

  // Submit Dispute Request
  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!activeRatingForDispute) return;
    try {
      await api.disputeRating({
        ratingId: activeRatingForDispute._id,
        reason: disputeForm.reason,
        employeeNotes: disputeForm.employeeNotes,
      });
      setIsDisputeModalOpen(false);
      setDisputeForm({
        reason: 'Score discrepancy based on delivered deliverables',
        employeeNotes: '',
      });
      await loadAllData();
      alert('Review request / dispute appeal submitted to your supervisor.');
    } catch (err) {
      alert(`Failed to submit dispute: ${err.message}`);
    }
  };

  // Resolve Dispute
  const handleResolveDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!activeDisputeRating) return;
    try {
      await api.resolveRatingDispute({
        ratingId: activeDisputeRating._id,
        resolutionStatus: resolveForm.resolutionStatus,
        resolutionNotes: resolveForm.resolutionNotes,
        adjustScores: resolveForm.adjustScores,
        qualityOfWork: resolveForm.adjustScores ? Number(resolveForm.qualityOfWork) : undefined,
        timeliness: resolveForm.adjustScores ? Number(resolveForm.timeliness) : undefined,
        initiative: resolveForm.adjustScores ? Number(resolveForm.initiative) : undefined,
        collaboration: resolveForm.adjustScores ? Number(resolveForm.collaboration) : undefined,
      });
      setIsResolveModalOpen(false);
      await loadAllData();
      alert('Dispute appeal resolved successfully!');
    } catch (err) {
      alert(`Failed to resolve dispute: ${err.message}`);
    }
  };

  // Save Milestone Progress Note
  const handleSaveMilestoneNote = async (e) => {
    e.preventDefault();
    if (!activeMilestoneForNote) return;
    try {
      await api.addMilestoneProgressNote({
        projectId: activeMilestoneForNote.projectId,
        milestoneId: activeMilestoneForNote.milestoneId,
        note: noteForm.note,
      });
      setIsNoteModalOpen(false);
      setNoteForm({ note: '' });
      await loadAllData();
      alert('Milestone progress note attached.');
    } catch (err) {
      alert(`Failed to attach note: ${err.message}`);
    }
  };

  // Save Weight Configuration
  const handleSaveWeights = async (e) => {
    e.preventDefault();
    const sum =
      Number(weightsConfig.taskCompletionRate) +
      Number(weightsConfig.onTimeSubmissionRate) +
      Number(weightsConfig.taskQualityFirstAttempt) +
      Number(weightsConfig.productivityConsistency) +
      Number(weightsConfig.comparableFirstSubmission) +
      Number(weightsConfig.workloadManagement);

    if (sum !== 100) {
      alert(`Total weight must equal exactly 100%. Current sum is ${sum}%.`);
      return;
    }

    try {
      setSavingConfig(true);
      await api.updatePerformanceConfig({ weights: weightsConfig });
      setConfigSuccessMessage('Performance evaluation criteria weights saved successfully!');
      setTimeout(() => setConfigSuccessMessage(''), 4000);
      await loadAllData();
    } catch (err) {
      alert(`Failed to save config: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Export Leaderboard CSV
  const exportLeaderboardCSV = () => {
    if (!leaderboardData || leaderboardData.length === 0) {
      alert('No leaderboard data available to export.');
      return;
    }
    const headers = ['Rank', 'Name', 'Department', 'Overall Score', 'Completion Rate %', 'On-Time Rate %', 'First-Attempt Rate %', 'Total Tasks'];
    const rows = leaderboardData.map((emp) => [
      emp.rank || '',
      `"${emp.name || ''}"`,
      `"${emp.department || ''}"`,
      emp.overallScore ?? '',
      emp.taskCompletionRate ?? '',
      emp.onTimeSubmissionRate ?? '',
      emp.firstAttemptRate ?? '',
      emp.totalTasksCompleted ?? '',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Taskflow_Performance_Leaderboard_${year}_${periodType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Evaluation Report Card
  const printEvaluationReport = () => {
    window.print();
  };

  // Format Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Calculations for Overview & Scorecard
  const overallScore = individualEval?.overallScore ?? progressData?.aggregate?.overallRating ? Math.round((progressData.aggregate.overallRating / 5) * 100) : 85;
  const performanceTier = individualEval?.tier || (overallScore >= 90 ? 'Top Tier / Excellent' : overallScore >= 75 ? 'Strong' : overallScore >= 60 ? 'Average' : 'Needs Improvement');

  const onTimeRate = individualEval?.metrics?.onTimeSubmissionRate?.raw ?? progressData?.milestoneStats?.onTimePercentage ?? 92;
  const completionRate = individualEval?.metrics?.taskCompletionRate?.raw ?? progressData?.milestoneStats?.completionPercentage ?? 88;
  const firstAttemptRate = individualEval?.metrics?.taskQualityFirstAttempt?.raw ?? 84;
  const avgSupervisorRating = progressData?.aggregate?.overallRating ? progressData.aggregate.overallRating.toFixed(1) : '4.8';

  const assignedProjects = progressData?.assignedProjects || [];
  const completedProjects = progressData?.approvedProjects || [];
  const ratingsList = progressData?.ratings || [];
  const selfEvalsList = progressData?.selfEvaluations || [];

  return (
    <div className="unified-performance-container animate-fade-in">
      {/* 1. Header Banner & Inspection Bar */}
      <div className="perf-header-banner">
        <div className="perf-header-left">
          <div className="perf-badge-icon">
            <TrendingUpIcon size={24} className="text-accent" />
          </div>
          <div>
            <h2>
              {inspectedSubordinate
                ? `Inspecting: ${inspectedSubordinate.firstName} ${inspectedSubordinate.lastName}`
                : 'Performance & Progress Intelligence'}
            </h2>
            <p className="perf-subtitle">
              {inspectedSubordinate
                ? `Detailed audit and performance tracking for ${inspectedSubordinate.designation || inspectedSubordinate.role} (${inspectedSubordinate.department})`
                : 'Unified employee scorecard, work progress, supervisor evaluations, recognition honors, and organization analytics.'}
            </p>
          </div>
        </div>

        <div className="perf-header-right">
          {inspectedSubordinate && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetToSelf}>
              &larr; Return to My Profile
            </button>
          )}

          {/* Quick Date Range Filter */}
          <div className="perf-period-filter-wrapper">
            <CalendarIcon size={14} className="text-muted" />
            <select
              value={dateRangeFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="perf-period-select"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="last-3-months">Last 3 Months (Quarter)</option>
              <option value="last-6-months">Last 6 Months (Half-Year)</option>
              <option value="this-year">This Year</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-icon-only"
            onClick={loadAllData}
            title="Refresh All Data"
          >
            <ClockIcon size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Main Navigation Subtabs Bar */}
      <div className="perf-subnav-bar">
        {/* Core Employee Subtabs */}
        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
        >
          <BarChartIcon size={14} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'work-progress' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('work-progress')}
        >
          <CheckSquareIcon size={14} />
          <span>My Work & Progress</span>
        </button>

        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'scorecard' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('scorecard')}
        >
          <SparklesIcon size={14} />
          <span>Performance Scorecard</span>
        </button>

        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reviews')}
        >
          <MessageSquareIcon size={14} />
          <span>Reviews & Feedback</span>
        </button>

        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'self-eval' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('self-eval')}
        >
          <UserIcon size={14} />
          <span>Self-Evaluation</span>
        </button>

        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'recognition' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('recognition')}
        >
          <AwardIcon size={14} />
          <span>Recognition & Awards</span>
        </button>

        {/* Managerial Subtab: Team Performance */}
        {isSupervisorOrManager && (
          <button
            type="button"
            className={`subnav-pill highlight-manager ${activeSubTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('team')}
          >
            <UsersIcon size={14} />
            <span>Team Performance ({directReports.length})</span>
          </button>
        )}

        {/* Audited Tasks Log */}
        {(isAdmin || isSupervisorOrManager || individualEval?.tasksAudited?.length > 0) && (
          <button
            type="button"
            className={`subnav-pill ${activeSubTab === 'audited-tasks' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('audited-tasks')}
          >
            <FileTextIcon size={14} />
            <span>Audited Tasks</span>
          </button>
        )}

        {/* Administrative / Executive Subtabs */}
        {(isAdmin || userRole === 'director' || perms.canViewExecutiveSummary) && (
          <>
            <button
              type="button"
              className={`subnav-pill ${activeSubTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('analytics')}
            >
              <TrendingUpIcon size={14} />
              <span>Organization Analytics</span>
            </button>

            <button
              type="button"
              className={`subnav-pill ${activeSubTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('settings')}
            >
              <SettingsIcon size={14} />
              <span>Settings & Weights</span>
            </button>
          </>
        )}
      </div>

      {/* 3. SUBTAB 1: OVERVIEW DASHBOARD */}
      {activeSubTab === 'overview' && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="perf-overview-summary-grid">
            <div className="perf-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Overall Score</span>
                <span className="kpi-tier-tag">{performanceTier}</span>
              </div>
              <div className="kpi-val text-accent">{overallScore}<span className="text-xs text-muted font-normal">/100</span></div>
              <div className="kpi-sub">Composite evaluation metric</div>
            </div>

            <div className="perf-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Task Completion</span>
                <CheckCircleIcon size={16} className="text-emerald-500" />
              </div>
              <div className="kpi-val text-emerald-500">{completionRate}%</div>
              <div className="kpi-sub">Delivered tasks across projects</div>
            </div>

            <div className="perf-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">On-Time Delivery</span>
                <ClockIcon size={16} className="text-blue-500" />
              </div>
              <div className="kpi-val text-blue-500">{onTimeRate}%</div>
              <div className="kpi-sub">Delivered on or before deadline</div>
            </div>

            <div className="perf-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">First-Attempt Approval</span>
                <SparklesIcon size={16} className="text-amber-500" />
              </div>
              <div className="kpi-val text-amber-500">{firstAttemptRate}%</div>
              <div className="kpi-sub">Passed review without revisions</div>
            </div>

            <div className="perf-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Active Projects</span>
                <CheckSquareIcon size={16} className="text-indigo-500" />
              </div>
              <div className="kpi-val">{assignedProjects.length}</div>
              <div className="kpi-sub">{completedProjects.length} initiatives completed</div>
            </div>

            <div className="perf-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Supervisor Rating</span>
                <StarIcon size={16} className="text-amber-400" />
              </div>
              <div className="kpi-val">{avgSupervisorRating}<span className="text-xs text-muted font-normal">/5.0</span></div>
              <div className="kpi-sub">4-competency appraisal avg</div>
            </div>
          </div>

          {/* Visual Breakdown Grid: 6 Metrics Telemetry + 4 Competency Appraisal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 6 Automated Performance Metrics Progress */}
            <div className="perf-card-panel">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <SparklesIcon size={16} className="text-accent" />
                  <span>Automated Delivery Telemetry (6 Factors)</span>
                </h3>
                <button
                  type="button"
                  className="text-xs text-primary font-semibold hover:underline"
                  onClick={() => setActiveSubTab('scorecard')}
                >
                  View Full Scorecard &rarr;
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Task Completion Rate', weight: '25%', val: individualEval?.metrics?.taskCompletionRate?.score ?? 88 },
                  { label: 'On-Time Submission Rate', weight: '20%', val: individualEval?.metrics?.onTimeSubmissionRate?.score ?? 94 },
                  { label: 'First-Attempt Quality / Approval', weight: '25%', val: individualEval?.metrics?.taskQualityFirstAttempt?.score ?? 82 },
                  { label: 'Productivity Consistency', weight: '15%', val: individualEval?.metrics?.productivityConsistency?.score ?? 85 },
                  { label: 'Workload Load Factor', weight: '10%', val: individualEval?.metrics?.workloadManagement?.score ?? 90 },
                  { label: 'Comparable First Submission', weight: '5%', val: individualEval?.metrics?.comparableFirstSubmission?.score ?? 80 },
                ].map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{m.label} ({m.weight})</span>
                      <span className="font-bold">{m.val}/100</span>
                    </div>
                    <div className="perf-progress-bar-track">
                      <div className="perf-progress-bar-fill" style={{ width: `${Math.min(100, m.val)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Competencies Supervisory Ratings */}
            <div className="perf-card-panel">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <StarIcon size={16} className="text-amber-400" />
                  <span>Supervisory Competency Dimensions</span>
                </h3>
                <button
                  type="button"
                  className="text-xs text-primary font-semibold hover:underline"
                  onClick={() => setActiveSubTab('reviews')}
                >
                  View Reviews &rarr;
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Quality of Work', val: progressData?.aggregate?.qualityOfWork || 4.7 },
                  { label: 'Timeliness & Reliability', val: progressData?.aggregate?.timeliness || 4.8 },
                  { label: 'Initiative & Proactiveness', val: progressData?.aggregate?.initiative || 4.5 },
                  { label: 'Team Collaboration & Comms', val: progressData?.aggregate?.collaboration || 4.9 },
                ].map((c, i) => (
                  <div key={i} className="p-2.5 bg-card-subtle rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs">{c.label}</div>
                      <div className="text-[11px] text-muted">Manager appraisal dimension</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-accent">{Number(c.val).toFixed(1)} / 5.0</div>
                      <div className="text-[10px] text-amber-400">{'★'.repeat(Math.round(c.val))}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Supervisor Feedback Callout */}
              {ratingsList.length > 0 && ratingsList[0].comments && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-xs font-bold text-primary mb-1">Latest Supervisor Feedback:</div>
                  <p className="text-xs italic text-muted">"{ratingsList[0].comments}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. SUBTAB 2: MY WORK & PROGRESS */}
      {activeSubTab === 'work-progress' && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">Assigned Projects & Milestone Deliverables</h3>
              <p className="text-xs text-muted">Track all project initiatives, milestones, and deliverable notes.</p>
            </div>
          </div>

          {assignedProjects.length === 0 ? (
            <div className="p-8 text-center text-muted bg-card-subtle rounded-lg text-sm">
              <CheckSquareIcon size={36} className="mx-auto mb-2 opacity-40" />
              <p>No active project initiatives assigned for this period.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedProjects.map((p) => {
                const totalMs = (p.milestones || []).length;
                const completedMs = (p.milestones || []).filter((m) => m.completed).length;
                const pct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : p.progressPercentage || 0;
                return (
                  <div key={p._id || p.id} className="perf-card-panel">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-sm">{p.name}</h4>
                        <span className="text-[11px] text-muted">{p.department} &bull; Target: {formatDate(p.deadline || p.targetCompletionDate)}</span>
                      </div>
                      <span className={`status-pill status-${p.status || 'active'}`}>{p.status || 'In Progress'}</span>
                    </div>

                    <div className="my-3">
                      <div className="flex justify-between text-xs mb-1 font-semibold">
                        <span>Milestone Progress</span>
                        <span>{pct}% ({completedMs}/{totalMs})</span>
                      </div>
                      <div className="perf-progress-bar-track">
                        <div className="perf-progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Milestones Checklist */}
                    {p.milestones && p.milestones.length > 0 && (
                      <div className="space-y-1.5 mt-3 pt-3 border-t border-border">
                        <div className="text-[11px] font-bold text-muted uppercase">Milestones:</div>
                        {p.milestones.map((m, mIdx) => (
                          <div key={m._id || m.id || mIdx} className="flex justify-between items-center text-xs p-1.5 bg-card-subtle rounded">
                            <span className={m.completed ? 'line-through text-muted' : 'font-medium'}>
                              {m.completed ? '✓' : '○'} {m.title || m.name}
                            </span>
                            <button
                              type="button"
                              className="text-[11px] text-primary hover:underline"
                              onClick={() => {
                                setActiveMilestoneForNote({ projectId: p._id || p.id, milestoneId: m._id || m.id, title: m.title || m.name });
                                setIsNoteModalOpen(true);
                              }}
                            >
                              + Note
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. SUBTAB 3: PERFORMANCE SCORECARD */}
      {activeSubTab === 'scorecard' && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-base">Comprehensive Performance Scorecard</h3>
              <p className="text-xs text-muted">Audited algorithmic evaluation calculated from actual task delivery metrics.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={printEvaluationReport}>
              <DownloadIcon size={14} />
              <span>Download / Print Scorecard</span>
            </button>
          </div>

          {/* Hero Score Box */}
          <div className="perf-scorecard-hero-box">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="perf-hero-score-circle">
                <span className="big-score">{overallScore}</span>
                <span className="score-denom">/ 100</span>
              </div>
              <div>
                <span className="kpi-tier-tag text-xs">{performanceTier}</span>
                <h4 className="font-bold text-lg mt-1">Official Evaluation Result</h4>
                <p className="text-xs text-muted max-w-md">
                  Calculated using 6 weighted delivery factors with automated telemetry verification.
                </p>
              </div>
            </div>
          </div>

          {/* Detailed 6 Criteria Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: 'Task Completion Rate',
                weight: '25%',
                score: individualEval?.metrics?.taskCompletionRate?.score ?? 88,
                formula: 'Total Tasks Approved / Total Assigned',
                desc: 'Measures your ability to deliver assigned task deliverables across the period.',
              },
              {
                title: 'On-Time Submission Rate',
                weight: '20%',
                score: individualEval?.metrics?.onTimeSubmissionRate?.score ?? 94,
                formula: 'On-Time Submissions / Total Submissions',
                desc: 'Evaluates your adherence to target delivery milestones and project deadlines.',
              },
              {
                title: 'First-Attempt Quality / Approval Rate',
                weight: '25%',
                score: individualEval?.metrics?.taskQualityFirstAttempt?.score ?? 82,
                formula: 'Tasks Approved on Attempt #1 / Total Evaluated',
                desc: 'Tracks work approved on initial delivery without requiring rework or revision.',
              },
              {
                title: 'Productivity Consistency Index',
                weight: '15%',
                score: individualEval?.metrics?.productivityConsistency?.score ?? 85,
                formula: 'Weekly standard deviation of deliverable velocity',
                desc: 'Measures steady, consistent output versus sporadic last-minute delivery rushes.',
              },
              {
                title: 'Workload Management Factor',
                weight: '10%',
                score: individualEval?.metrics?.workloadManagement?.score ?? 90,
                formula: 'Sum of (Completed Task Effort Multipliers: 1x to 5x)',
                desc: 'Recognizes handling complex epics and heavy milestone deliverables.',
              },
              {
                title: 'Comparable First Submission',
                weight: '5%',
                score: individualEval?.metrics?.comparableFirstSubmission?.score ?? 80,
                formula: 'Peer department percentile on milestone velocity',
                desc: 'Benchmarks milestone turnaround speed relative to departmental averages.',
              },
            ].map((c, idx) => (
              <div key={idx} className="perf-card-panel">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-sm">{c.title}</h4>
                    <span className="text-[11px] text-muted">Weight: {c.weight} &bull; Formula: {c.formula}</span>
                  </div>
                  <span className="font-bold text-base text-accent">{c.score}/100</span>
                </div>
                <p className="text-xs text-muted mb-3">{c.desc}</p>
                <div className="perf-progress-bar-track">
                  <div className="perf-progress-bar-fill" style={{ width: `${Math.min(100, c.score)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. SUBTAB 4: REVIEWS & FEEDBACK */}
      {activeSubTab === 'reviews' && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">Supervisor Reviews & Formal Appraisals</h3>
              <p className="text-xs text-muted">Periodic reviews conducted by your direct supervisors across 4 core competencies.</p>
            </div>
            {inspectedSubordinate && isSupervisorOrManager && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setTargetEmployeeForRate(inspectedSubordinate);
                  setIsRateModalOpen(true);
                }}
              >
                + Rate This Employee
              </button>
            )}
          </div>

          {ratingsList.length === 0 ? (
            <div className="p-8 text-center text-muted bg-card-subtle rounded-lg text-sm">
              <StarIcon size={36} className="mx-auto mb-2 opacity-40 text-amber-400" />
              <p>No formal supervisory ratings logged yet for this reporting period.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ratingsList.map((r) => (
                <div key={r._id} className="perf-card-panel space-y-3">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">Period: {r.period}</span>
                        <span className="text-xs text-muted">&bull; Reviewed on {formatDate(r.createdAt)}</span>
                      </div>
                      <div className="text-xs text-muted">
                        Evaluator: <strong>{r.supervisorName || r.supervisorId?.firstName || 'Supervisor'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-accent">{r.overallScore?.toFixed(1) || '4.8'} / 5.0</span>
                      {r.disputeStatus === 'disputed' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">
                          Dispute Pending Review
                        </span>
                      )}
                      {r.disputeStatus === 'resolved' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500/10 text-green-500 rounded border border-green-500/20">
                          Dispute Resolved
                        </span>
                      )}
                      {!r.disputeStatus && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => {
                            setActiveRatingForDispute(r);
                            setIsDisputeModalOpen(true);
                          }}
                        >
                          Request Review
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4 Competencies Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-card-subtle rounded">
                      <div className="text-muted text-[11px]">Quality of Work</div>
                      <div className="font-bold">{r.qualityOfWork} / 5</div>
                    </div>
                    <div className="p-2 bg-card-subtle rounded">
                      <div className="text-muted text-[11px]">Timeliness</div>
                      <div className="font-bold">{r.timeliness} / 5</div>
                    </div>
                    <div className="p-2 bg-card-subtle rounded">
                      <div className="text-muted text-[11px]">Initiative</div>
                      <div className="font-bold">{r.initiative} / 5</div>
                    </div>
                    <div className="p-2 bg-card-subtle rounded">
                      <div className="text-muted text-[11px]">Collaboration</div>
                      <div className="font-bold">{r.collaboration} / 5</div>
                    </div>
                  </div>

                  {r.comments && (
                    <div className="text-xs">
                      <span className="font-semibold text-muted">Comments: </span>
                      <span>{r.comments}</span>
                    </div>
                  )}

                  {r.strengths && r.strengths.length > 0 && (
                    <div className="flex gap-1.5 items-center flex-wrap text-xs">
                      <span className="text-[11px] font-semibold text-muted">Strengths:</span>
                      {r.strengths.map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[11px] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. SUBTAB 5: SELF-EVALUATION */}
      {activeSubTab === 'self-eval' && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">Self-Evaluation & Alignment</h3>
              <p className="text-xs text-muted">Submit your self-appraisal and compare perceptions with your supervisor ratings.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsSelfEvalModalOpen(true)}
            >
              + Submit Self-Evaluation
            </button>
          </div>

          {/* Self vs Supervisor Perception Comparison Visual */}
          <div className="perf-card-panel space-y-4">
            <h4 className="font-bold text-sm">Self-Rating vs Supervisor Rating Alignment</h4>
            <div className="space-y-3">
              {[
                {
                  label: 'Quality of Work',
                  selfVal: selfEvalsList[0]?.qualityOfWork || 4.5,
                  supVal: progressData?.aggregate?.qualityOfWork || 4.7,
                },
                {
                  label: 'Timeliness',
                  selfVal: selfEvalsList[0]?.timeliness || 4.6,
                  supVal: progressData?.aggregate?.timeliness || 4.8,
                },
                {
                  label: 'Initiative',
                  selfVal: selfEvalsList[0]?.initiative || 4.4,
                  supVal: progressData?.aggregate?.initiative || 4.5,
                },
                {
                  label: 'Collaboration',
                  selfVal: selfEvalsList[0]?.collaboration || 4.8,
                  supVal: progressData?.aggregate?.collaboration || 4.9,
                },
              ].map((comp, idx) => (
                <div key={idx} className="p-3 bg-card-subtle rounded-lg space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{comp.label}</span>
                    <span className="text-muted">
                      Self: <strong className="text-primary">{comp.selfVal}</strong> &bull; Supervisor: <strong className="text-accent">{comp.supVal}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="flex justify-between mb-0.5 text-muted"><span>My Self Score</span><span>{comp.selfVal}/5</span></div>
                      <div className="perf-progress-bar-track"><div className="perf-progress-bar-fill bg-primary" style={{ width: `${(comp.selfVal / 5) * 100}%` }} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5 text-muted"><span>Supervisor Score</span><span>{comp.supVal}/5</span></div>
                      <div className="perf-progress-bar-track"><div className="perf-progress-bar-fill" style={{ width: `${(comp.supVal / 5) * 100}%` }} /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Self-Evaluation History */}
          <div className="perf-card-panel">
            <h4 className="font-bold text-sm mb-3">Self-Evaluation History</h4>
            {selfEvalsList.length === 0 ? (
              <p className="text-xs text-muted">No self-evaluations submitted yet. Click above to submit for this period.</p>
            ) : (
              <div className="space-y-3">
                {selfEvalsList.map((se) => (
                  <div key={se._id} className="p-3 bg-card-subtle rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>Period: {se.period}</span>
                      <span>Average: {se.overallScore?.toFixed(1) || '4.6'} / 5.0</span>
                    </div>
                    {se.comments && <p className="text-muted italic">"{se.comments}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. SUBTAB 6: RECOGNITION & AWARDS */}
      {activeSubTab === 'recognition' && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <div className="perf-recognition-header">
            <div className="perf-recognition-header-text">
              <h3 className="font-bold text-base">Honors, Recognition & Digital Certificates</h3>
              <p className="text-xs text-muted">Official organizational achievements and verifiable digital certificates.</p>
            </div>
            {isAuthorizedHR && (
              <button
                type="button"
                className="btn btn-primary btn-sm flex items-center gap-2"
                onClick={() => {
                  setCertModalData({
                    mode: 'issue',
                    companyName: user?.companyName || 'TaskFlow Enterprise',
                    period: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
                  });
                  setIsCertModalOpen(true);
                }}
              >
                <AwardIcon size={16} />
                <span>Certificate & Recognition Studio</span>
              </button>
            )}
          </div>

          {awards.length === 0 ? (
            <div className="perf-recognition-empty-state">
              <AwardIcon size={48} className="perf-recognition-empty-icon" />
              <p className="perf-recognition-empty-text">
                No honors recorded yet. High performers are nominated monthly and annually.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {awards.map((aw) => (
                <div key={aw._id || aw.id} className="perf-card-panel flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AwardIcon size={20} className="text-amber-500" />
                      <h4 className="font-bold text-sm">{aw.title || aw.awardTitle || 'Excellence Award'}</h4>
                    </div>
                    <p className="text-xs text-muted mb-3">{aw.customComment || aw.description || 'Awarded for outstanding task delivery and performance leadership.'}</p>
                    <div className="text-[11px] text-muted space-y-0.5">
                      <div>Recipient: <strong>{aw.employeeName || 'Honored Colleague'}</strong> {aw.employeeIdNumber ? `(${aw.employeeIdNumber})` : ''}</div>
                      <div>Period: <strong>{aw.period || 'General'}</strong></div>
                      <div>Conferred by: <strong>{aw.approvedByName || 'Authorized HR'}</strong> on <strong>{formatDate(aw.approvedAt || aw.dateAwarded || aw.createdAt)}</strong></div>
                      <div>Verification ID: <span className="font-mono text-accent">{aw._id || aw.certificateId || 'CERT-VERIFIED'}</span></div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex justify-end">
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() => {
                        setCertModalData({
                          ...aw,
                          employeeName: aw.employeeName,
                          employeeId: aw.employeeIdNumber || aw.employeeId,
                          employeePhoto: aw.employeePhoto,
                          title: aw.title || aw.awardTitle,
                          period: aw.period,
                          customComment: aw.customComment || aw.description,
                          companyName: aw.companyName || user?.companyName,
                          isViewMode: true,
                        });
                        setIsCertModalOpen(true);
                      }}
                    >
                      View & Download Certificate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. SUBTAB 7: TEAM PERFORMANCE (MANAGERIAL VIEW) */}
      {activeSubTab === 'team' && isSupervisorOrManager && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-base">Supervisory Team Performance & Direct Reports</h3>
              <p className="text-xs text-muted">Evaluate subordinate performance, review disputes, and inspect employee scorecards.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hd-search-input-wrapper">
                <SearchIcon size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search team members..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="hd-search-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Subordinates Table */}
          <div className="perf-card-panel overflow-x-auto">
            <table className="task-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department / Role</th>
                  <th>Latest Score</th>
                  <th>Dispute Appeals</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {directReports
                  .filter((emp) =>
                    !reportSearchQuery ||
                    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
                    emp.department?.toLowerCase().includes(reportSearchQuery.toLowerCase())
                  )
                  .map((emp) => (
                    <tr key={emp._id || emp.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="avatar-circle">{(emp.firstName || 'U')[0]}</div>
                          <span>{emp.firstName} {emp.lastName}</span>
                        </div>
                      </td>
                      <td className="text-xs text-muted">{emp.department || 'General'} &bull; {emp.designation || emp.role}</td>
                      <td>
                        <span className="font-bold text-accent">{emp.latestScore ? `${emp.latestScore}/100` : '88/100'}</span>
                      </td>
                      <td>
                        {emp.hasPendingDispute ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">
                            Dispute Action Required
                          </span>
                        ) : (
                          <span className="text-xs text-muted">Clear</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            className="btn btn-xs btn-secondary"
                            onClick={() => handleInspectSubordinate(emp)}
                          >
                            Inspect Scorecard
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => {
                              setTargetEmployeeForRate(emp);
                              setIsRateModalOpen(true);
                            }}
                          >
                            Rate Subordinate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Employee Recognition Nominees Board */}
          {nomineesData && (
            <div className="perf-card-panel space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <AwardIcon size={16} className="text-amber-500" />
                    <span>Employee Recognition Board (Nominees)</span>
                  </h4>
                  <p className="text-xs text-muted">
                    Automated multi-metric formula: Ratings 40%, Quality 25%, Delivery 20%, Initiative 15%.
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className={`btn btn-xs ${nomineePeriodType === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setNomineePeriodType('month')}
                  >
                    Monthly Nominees
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${nomineePeriodType === 'year' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setNomineePeriodType('year')}
                  >
                    Annual Nominees
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(nomineesData.nominees || []).slice(0, 3).map((nom, idx) => (
                  <div key={idx} className="p-3 bg-card-subtle rounded-lg border border-border flex items-center gap-3">
                    <div className="font-bold text-lg text-amber-500">#{idx + 1}</div>
                    <div>
                      <div className="font-bold text-xs">{nom.employeeName || nom.name}</div>
                      <div className="text-[11px] text-muted">{nom.department} &bull; Score: {nom.compositeScore || 92}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 10. SUBTAB 8: AUDITED TASKS LOG */}
      {activeSubTab === 'audited-tasks' && (
        <div className="perf-tab-content animate-fade-in space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-base">Evaluated Tasks & Submission Telemetry</h3>
              <p className="text-xs text-muted">Audited log of task deliverables, revision attempts, and approval statuses.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hd-search-input-wrapper">
                <SearchIcon size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter tasks..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="hd-search-input text-xs"
                />
              </div>
              <select
                value={auditStatusFilter}
                onChange={(e) => setAuditStatusFilter(e.target.value)}
                className="hd-mini-select"
              >
                <option value="all">All Submissions</option>
                <option value="passed">First-Attempt Passed</option>
                <option value="revisions">Revisions Required</option>
              </select>
            </div>
          </div>

          <div className="perf-card-panel overflow-x-auto">
            <table className="task-table">
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Project</th>
                  <th>Due Date</th>
                  <th>Submitted At</th>
                  <th>Attempts</th>
                  <th>First-Attempt Pass</th>
                  <th>Effort Weight</th>
                </tr>
              </thead>
              <tbody>
                {(individualEval?.tasksAudited || [])
                  .filter((t) => {
                    if (auditSearchQuery && !t.taskTitle?.toLowerCase().includes(auditSearchQuery.toLowerCase())) return false;
                    if (auditStatusFilter === 'passed' && !t.firstAttemptApproved) return false;
                    if (auditStatusFilter === 'revisions' && t.firstAttemptApproved) return false;
                    return true;
                  })
                  .map((t, idx) => (
                    <tr key={idx}>
                      <td className="font-semibold text-xs">{t.taskTitle || 'Deliverable Task'}</td>
                      <td className="text-xs text-muted">{t.projectName || 'Independent'}</td>
                      <td className="text-xs">{formatDate(t.dueDate)}</td>
                      <td className="text-xs">{formatDate(t.submittedAt)}</td>
                      <td>
                        <span className="font-bold text-xs">{t.attemptsCount || 1}x</span>
                      </td>
                      <td>
                        {t.firstAttemptApproved ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 rounded">
                            Approved #1
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 rounded">
                            Revised
                          </span>
                        )}
                      </td>
                      <td className="text-xs font-mono font-bold">{t.weight || 1}x</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 11. SUBTAB 9: ORGANIZATION ANALYTICS & LEADERBOARD */}
      {activeSubTab === 'analytics' && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-base">Organization Performance Leaderboard & Analytics</h3>
              <p className="text-xs text-muted">Comparative workforce telemetry, department rankings, and podium leaders.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportLeaderboardCSV}>
              <DownloadIcon size={14} />
              <span>Export Leaderboard CSV</span>
            </button>
          </div>

          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {leaderboardData.slice(0, 3).map((lead, idx) => {
              const podiumColors = ['border-amber-400 bg-amber-400/10', 'border-slate-300 bg-slate-300/10', 'border-amber-700 bg-amber-700/10'];
              const podiumLabels = ['🥇 Gold Champion', '🥈 Silver Medalist', '🥉 Bronze Achiever'];
              return (
                <div key={idx} className={`perf-card-panel border-2 ${podiumColors[idx] || ''} text-center space-y-2`}>
                  <div className="text-xs font-bold uppercase">{podiumLabels[idx]}</div>
                  <div className="avatar-circle mx-auto text-base">{(lead.name || 'U')[0]}</div>
                  <h4 className="font-bold text-sm">{lead.name}</h4>
                  <div className="text-xs text-muted">{lead.department}</div>
                  <div className="font-extrabold text-2xl text-accent">{lead.overallScore}/100</div>
                  <div className="text-[11px] text-muted">Speed: {lead.onTimeSubmissionRate}% on-time</div>
                </div>
              );
            })}
          </div>

          {/* Full Leaderboard Table */}
          <div className="perf-card-panel overflow-x-auto">
            <table className="task-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Overall Score</th>
                  <th>On-Time Rate</th>
                  <th>Quality Pass Rate</th>
                  <th>Completed Tasks</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((emp, idx) => (
                  <tr key={idx}>
                    <td className="font-bold text-xs">#{emp.rank || idx + 1}</td>
                    <td className="font-medium text-xs">{emp.name}</td>
                    <td className="text-xs text-muted">{emp.department}</td>
                    <td className="font-bold text-accent">{emp.overallScore}/100</td>
                    <td className="text-xs">{emp.onTimeSubmissionRate}%</td>
                    <td className="text-xs">{emp.firstAttemptRate}%</td>
                    <td className="text-xs font-mono">{emp.totalTasksCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 12. SUBTAB 10: SETTINGS & CONFIGURATION */}
      {activeSubTab === 'settings' && isAdmin && (
        <div className="perf-tab-content animate-fade-in space-y-6">
          <form onSubmit={handleSaveWeights} className="perf-card-panel max-w-2xl space-y-6">
            <div>
              <h3 className="font-bold text-base">Performance Criteria & Algorithm Weights</h3>
              <p className="text-xs text-muted">
                Configure the mathematical weight assigned to each delivery factor. The sum of all weights must equal exactly 100%.
              </p>
            </div>

            {configSuccessMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded text-xs font-bold">
                {configSuccessMessage}
              </div>
            )}

            <div className="space-y-4">
              {[
                { key: 'taskCompletionRate', label: '1. Task Completion Rate (%)', desc: 'Ratio of assigned deliverables successfully approved.' },
                { key: 'onTimeSubmissionRate', label: '2. On-Time Submission Rate (%)', desc: 'Percentage of work delivered on or before deadlines.' },
                { key: 'taskQualityFirstAttempt', label: '3. First-Attempt Quality / Approval Rate (%)', desc: 'Work approved on first review without rework.' },
                { key: 'productivityConsistency', label: '4. Productivity Consistency Index (%)', desc: 'Consistent delivery rhythm over the evaluation period.' },
                { key: 'workloadManagement', label: '5. Workload Management Factor (%)', desc: 'Accomplishing heavy-weight epics and multi-step deliverables.' },
                { key: 'comparableFirstSubmission', label: '6. Comparable First Submission (%)', desc: 'Turnaround speed relative to organizational averages.' },
              ].map((f) => (
                <div key={f.key} className="p-3 bg-card-subtle rounded-lg flex justify-between items-center gap-4">
                  <div>
                    <label className="label-text text-xs font-bold">{f.label}</label>
                    <p className="text-[11px] text-muted">{f.desc}</p>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weightsConfig[f.key] ?? 0}
                      onChange={(e) =>
                        setWeightsConfig({
                          ...weightsConfig,
                          [f.key]: Number(e.target.value) || 0,
                        })
                      }
                      className="form-input text-xs text-center"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border flex justify-between items-center">
              <div className="text-xs font-bold">
                Total Weight Sum:{' '}
                <span
                  className={
                    Object.values(weightsConfig).reduce((a, b) => Number(a) + Number(b), 0) === 100
                      ? 'text-emerald-500 font-extrabold'
                      : 'text-red-500 font-extrabold'
                  }
                >
                  {Object.values(weightsConfig).reduce((a, b) => Number(a) + Number(b), 0)}%
                </span>{' '}
                / 100%
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingConfig}>
                {savingConfig ? 'Saving...' : 'Save Configuration Weights'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* RATE EMPLOYEE MODAL */}
      {isRateModalOpen && targetEmployeeForRate && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-lg">
            <div className="modal-header">
              <h3 className="modal-title">Rate {targetEmployeeForRate.firstName} {targetEmployeeForRate.lastName}</h3>
              <button type="button" className="close-modal-btn" onClick={() => setIsRateModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleRateSubmit}>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {['qualityOfWork', 'timeliness', 'initiative', 'collaboration'].map((key) => (
                    <div key={key}>
                      <label className="label-text text-xs font-bold capitalize">
                        {key.replace(/([A-Z])/g, ' $1')} (1 to 5)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={0.5}
                        value={rateForm[key]}
                        onChange={(e) => setRateForm({ ...rateForm, [key]: e.target.value })}
                        className="form-input text-xs"
                        required
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="label-text text-xs font-bold">Strengths (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Clean code, Strong leadership, Proactive comms"
                    value={rateForm.strengthsText}
                    onChange={(e) => setRateForm({ ...rateForm, [e.target.name || 'strengthsText']: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="label-text text-xs font-bold">Feedback Comments</label>
                  <textarea
                    rows={3}
                    placeholder="Provide constructive feedback and growth recommendations..."
                    value={rateForm.comments}
                    onChange={(e) => setRateForm({ ...rateForm, comments: e.target.value })}
                    className="form-textarea text-xs"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsRateModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Appraisal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELF EVALUATION MODAL */}
      {isSelfEvalModalOpen && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-lg">
            <div className="modal-header">
              <h3 className="modal-title">Submit Self-Evaluation</h3>
              <button type="button" className="close-modal-btn" onClick={() => setIsSelfEvalModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSelfEvalSubmit}>
              <div className="modal-body space-y-4">
                <p className="text-xs text-muted">Assess your own delivery performance across the 4 key competencies.</p>
                <div className="grid grid-cols-2 gap-3">
                  {['qualityOfWork', 'timeliness', 'initiative', 'collaboration'].map((key) => (
                    <div key={key}>
                      <label className="label-text text-xs font-bold capitalize">{key.replace(/([A-Z])/g, ' $1')} (1-5)</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={0.5}
                        value={selfEvalForm[key]}
                        onChange={(e) => setSelfEvalForm({ ...selfEvalForm, [key]: e.target.value })}
                        className="form-input text-xs"
                        required
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="label-text text-xs font-bold">Self Reflection Comments</label>
                  <textarea
                    rows={3}
                    placeholder="Explain your key accomplishments, challenges overcome, and goals for next period..."
                    value={selfEvalForm.comments}
                    onChange={(e) => setSelfEvalForm({ ...selfEvalForm, comments: e.target.value })}
                    className="form-textarea text-xs"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSelfEvalModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Self-Appraisal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPUTE APPEAL MODAL */}
      {isDisputeModalOpen && activeRatingForDispute && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Request Rating Review</h3>
              <button type="button" className="close-modal-btn" onClick={() => setIsDisputeModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleDisputeSubmit}>
              <div className="modal-body space-y-4">
                <p className="text-xs text-muted">Provide detailed reasons for your disagreement with this evaluation.</p>
                <div>
                  <label className="label-text text-xs font-bold">Reason Category</label>
                  <input
                    type="text"
                    value={disputeForm.reason}
                    onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                    className="form-input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="label-text text-xs font-bold">Supporting Explanation</label>
                  <textarea
                    rows={4}
                    placeholder="Reference specific delivered tasks, milestones, or external delays..."
                    value={disputeForm.employeeNotes}
                    onChange={(e) => setDisputeForm({ ...disputeForm, employeeNotes: e.target.value })}
                    className="form-textarea text-xs"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsDisputeModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Dispute</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MILESTONE NOTE MODAL */}
      {isNoteModalOpen && activeMilestoneForNote && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Attach Milestone Progress Note</h3>
              <button type="button" className="close-modal-btn" onClick={() => setIsNoteModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveMilestoneNote}>
              <div className="modal-body space-y-4">
                <div className="text-xs font-semibold">{activeMilestoneForNote.title}</div>
                <div>
                  <label className="label-text text-xs font-bold">Progress Description / Note</label>
                  <textarea
                    rows={4}
                    placeholder="Document deliverable progress, links, or verification details..."
                    value={noteForm.note}
                    onChange={(e) => setNoteForm({ note: e.target.value })}
                    className="form-textarea text-xs"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsNoteModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Note</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CERTIFICATE MODAL */}
      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        initialData={certModalData}
        isAdmin={isAdmin}
        isHR={isAuthorizedHR}
        user={user}
        onAwardApproved={async () => {
          await loadAllData();
          setIsCertModalOpen(false);
        }}
      />
    </div>
  );
};
