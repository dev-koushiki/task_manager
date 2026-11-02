import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  AwardIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  SearchIcon,
  FilterIcon,
  DownloadIcon,
  SettingsIcon,
  BarChartIcon,
  UserIcon,
  FileTextIcon,
  SparklesIcon,
  ChevronRightIcon,
  XIcon,
} from './Icons';

export const PerformanceDashboardView = ({
  user,
  isAdmin = false,
  selectedEmployeeId = null,
  onOpenDirectory,
}) => {
  // Navigation & View State
  const [activeSubTab, setActiveSubTab] = useState(isAdmin ? 'analytics' : 'individual');
  const [periodType, setPeriodType] = useState('month');
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodValue, setPeriodValue] = useState('');

  // Data State
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [individualEval, setIndividualEval] = useState(null);
  const [activeEmployeeId, setActiveEmployeeId] = useState(selectedEmployeeId || user?._id);

  // Filters State
  const [leaderboardSort, setLeaderboardSort] = useState('overallScore');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Config Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
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

  useEffect(() => {
    if (selectedEmployeeId) {
      setActiveEmployeeId(selectedEmployeeId);
      setActiveSubTab('individual');
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    loadAllPerformanceData();
  }, [periodType, year, periodValue, activeEmployeeId]);

  const loadAllPerformanceData = async () => {
    try {
      setLoading(true);

      const params = { periodType, year, periodValue };

      // 1. Load Organization Analytics (if Admin or Level 1-2)
      if (isAdmin) {
        try {
          const aRes = await api.getPerformanceAnalytics(params);
          if (aRes && aRes.analytics) {
            setAnalyticsData(aRes.analytics);
          }
        } catch (e) {
          console.warn('Analytics fetch error:', e);
        }
      }

      // 2. Load Leaderboard
      try {
        const lRes = await api.getPerformanceLeaderboard({
          ...params,
          sortBy: leaderboardSort,
          department: departmentFilter,
        });
        if (lRes && lRes.leaderboard) {
          setLeaderboardData(lRes.leaderboard);
        }
      } catch (e) {
        console.warn('Leaderboard fetch error:', e);
      }

      // 3. Load Individual Evaluation
      const targetId = activeEmployeeId || user?._id;
      if (targetId) {
        try {
          const evalRes = await api.getEmployeePerformanceEvaluation(targetId, params);
          if (evalRes && evalRes.evaluation) {
            setIndividualEval(evalRes.evaluation);
          }
        } catch (e) {
          console.warn('Individual eval fetch error:', e);
        }
      }

      // 4. Load Config if Admin
      if (isAdmin) {
        try {
          const cfgRes = await api.getPerformanceConfig();
          if (cfgRes?.config?.weights) {
            setWeightsConfig(cfgRes.config.weights);
          }
        } catch (e) {
          console.warn('Config fetch error:', e);
        }
      }
    } catch (err) {
      console.error('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const sum =
      Number(weightsConfig.taskCompletionRate) +
      Number(weightsConfig.onTimeSubmissionRate) +
      Number(weightsConfig.taskQualityFirstAttempt) +
      Number(weightsConfig.productivityConsistency) +
      Number(weightsConfig.comparableFirstSubmission) +
      Number(weightsConfig.workloadManagement);

    if (sum !== 100) {
      alert(`The sum of all scoring weights must equal 100%. Current sum: ${sum}%`);
      return;
    }

    try {
      setSavingConfig(true);
      await api.updatePerformanceConfig({ weights: weightsConfig });
      setConfigSuccessMessage('Performance evaluation weights updated successfully!');
      setTimeout(() => {
        setIsConfigModalOpen(false);
        setConfigSuccessMessage('');
        loadAllPerformanceData();
      }, 1200);
    } catch (err) {
      alert(`Failed to save config: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const getScoreColor = (score, level) => {
    if (level === 'Insufficient Data' || !score) return '#94a3b8';
    if (score >= 90) return '#10b981'; // Green (Outstanding)
    if (score >= 80) return '#06b6d4'; // Teal/Cyan (Excellent)
    if (score >= 70) return '#3b82f6'; // Blue (Very Good)
    if (score >= 60) return '#6366f1'; // Indigo (Good)
    if (score >= 50) return '#f59e0b'; // Orange (Needs Improvement)
    return '#ef4444'; // Red (Poor)
  };

  const getLevelBadgeClass = (level) => {
    switch (level) {
      case 'Outstanding':
      case 'Excellent':
        return 'level-badge-outstanding';
      case 'Very Good':
      case 'Good':
        return 'level-badge-good';
      case 'Needs Improvement':
        return 'level-badge-warning';
      case 'Poor':
        return 'level-badge-danger';
      default:
        return 'level-badge-muted';
    }
  };

  const exportLeaderboardCSV = () => {
    if (!leaderboardData || leaderboardData.length === 0) return;
    const headers = [
      'Rank',
      'Employee Name',
      'Employee ID',
      'Department',
      'Designation',
      'Overall Score (0-100)',
      'Performance Level',
      'Task Completion Rate (%)',
      'On-Time Rate (%)',
      'Completed Tasks',
      'First-Attempt Approved Tasks',
      'First Submission Achievements',
      'Trend',
    ];

    const rows = leaderboardData.map((e) => [
      e.rank,
      `"${e.employeeName || ''}"`,
      `"${e.employeeIdNumber || ''}"`,
      `"${e.department || 'General'}"`,
      `"${e.designation || 'Specialist'}"`,
      e.hasSufficientData ? e.overallScore : 'N/A',
      `"${e.performanceLevel || 'Insufficient Data'}"`,
      e.metrics?.taskCompletion?.completionRate ?? 0,
      e.metrics?.submissionSpeed?.onTimeRate ?? 0,
      e.metrics?.taskCompletion?.totalCompleted ?? 0,
      e.metrics?.quality?.firstAttemptApprovedCount ?? 0,
      e.metrics?.firstSubmission?.comparableFirstSubmissionsCount ?? 0,
      `"${e.trend || 'stable'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TaskFlow_Leaderboard_${periodType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printEvaluationReport = () => {
    window.print();
  };

  // Departments list for filtering
  const departments = Array.from(new Set(leaderboardData.map((e) => e.department).filter(Boolean)));

  return (
    <div className="performance-dashboard-container animate-fade-in">
      {/* ================= HEADER & PERIOD CONTROLS ================= */}
      <div className="perf-header-banner">
        <div className="perf-header-left">
          <div className="perf-badge-icon">
            <AwardIcon size={24} />
          </div>
          <div>
            <h2>Automated Employee Performance & Periodic Analytics</h2>
            <p className="perf-subtitle">
              Calculated dynamically from real task submissions, on-time delivery timestamps, quality audits, and work consistency
            </p>
          </div>
        </div>

        <div className="perf-header-right">
          {/* Period Selection Tabs: Monthly, Quarterly, Half-Yearly, Yearly */}
          <div className="period-segmented-control">
            <button
              type="button"
              className={`segment-btn ${periodType === 'month' ? 'active' : ''}`}
              onClick={() => {
                setPeriodType('month');
                setPeriodValue('');
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`segment-btn ${periodType === 'quarter' ? 'active' : ''}`}
              onClick={() => {
                setPeriodType('quarter');
                setPeriodValue('');
              }}
            >
              Quarterly
            </button>
            <button
              type="button"
              className={`segment-btn ${periodType === 'half-year' ? 'active' : ''}`}
              onClick={() => {
                setPeriodType('half-year');
                setPeriodValue('');
              }}
            >
              Half-Yearly
            </button>
            <button
              type="button"
              className={`segment-btn ${periodType === 'year' ? 'active' : ''}`}
              onClick={() => {
                setPeriodType('year');
                setPeriodValue('');
              }}
            >
              Yearly
            </button>
          </div>

          {/* Period Details Picker */}
          <div className="period-picker-box">
            {periodType === 'month' && (
              <select
                value={periodValue || `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="period-dropdown"
              >
                {[
                  { val: `${year}-01`, label: `January ${year}` },
                  { val: `${year}-02`, label: `February ${year}` },
                  { val: `${year}-03`, label: `March ${year}` },
                  { val: `${year}-04`, label: `April ${year}` },
                  { val: `${year}-05`, label: `May ${year}` },
                  { val: `${year}-06`, label: `June ${year}` },
                  { val: `${year}-07`, label: `July ${year}` },
                  { val: `${year}-08`, label: `August ${year}` },
                  { val: `${year}-09`, label: `September ${year}` },
                  { val: `${year}-10`, label: `October ${year}` },
                  { val: `${year}-11`, label: `November ${year}` },
                  { val: `${year}-12`, label: `December ${year}` },
                ].map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}

            {periodType === 'quarter' && (
              <select
                value={periodValue || `${year}-Q${Math.floor(new Date().getMonth() / 3) + 1}`}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="period-dropdown"
              >
                <option value={`${year}-Q1`}>Q1 {year} (Jan – Mar)</option>
                <option value={`${year}-Q2`}>Q2 {year} (Apr – Jun)</option>
                <option value={`${year}-Q3`}>Q3 {year} (Jul – Sep)</option>
                <option value={`${year}-Q4`}>Q4 {year} (Oct – Dec)</option>
              </select>
            )}

            {periodType === 'half-year' && (
              <select
                value={periodValue || `${year}-H${new Date().getMonth() < 6 ? 1 : 2}`}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="period-dropdown"
              >
                <option value={`${year}-H1`}>H1 {year} (Jan – Jun)</option>
                <option value={`${year}-H2`}>H2 {year} (Jul – Dec)</option>
              </select>
            )}

            {periodType === 'year' && (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="period-dropdown"
              >
                <option value={2026}>Year 2026</option>
                <option value={2025}>Year 2025</option>
                <option value={2024}>Year 2024</option>
              </select>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="perf-header-buttons">
            {onOpenDirectory && (
              <button
                type="button"
                className="btn-outline-perf"
                onClick={onOpenDirectory}
                title="Open comprehensive Employee Directory"
              >
                <UserIcon size={14} /> Employee Directory
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className="btn-outline-perf"
                onClick={() => setIsConfigModalOpen(true)}
                title="Configure scoring weights and thresholds"
              >
                <SettingsIcon size={14} /> Scoring Weights
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= SUB-NAVIGATION TABS ================= */}
      <div className="perf-subnav-bar">
        {isAdmin && (
          <button
            type="button"
            className={`subnav-pill ${activeSubTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('analytics')}
          >
            <BarChartIcon size={15} /> Performance Analytics & Comparison
          </button>
        )}
        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('leaderboard')}
        >
          <AwardIcon size={15} /> Performance Leaderboard
        </button>
        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'individual' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('individual')}
        >
          <UserIcon size={15} />{' '}
          {activeEmployeeId && activeEmployeeId !== user?._id && individualEval
            ? `Evaluation: ${individualEval.employeeName}`
            : 'My Performance Evaluation'}
        </button>
        <button
          type="button"
          className={`subnav-pill ${activeSubTab === 'audited-tasks' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('audited-tasks')}
        >
          <FileTextIcon size={15} /> Audited Task History
        </button>
      </div>

      {/* ================= TAB 1: ANALYTICS & PERIOD COMPARISON ================= */}
      {activeSubTab === 'analytics' && isAdmin && (
        <div className="perf-tab-content animate-fade-in">
          {loading ? (
            <div className="perf-loading-box">
              <div className="spinner-medium"></div>
              <p>Analyzing organization deliverables and periodic telemetry...</p>
            </div>
          ) : analyticsData ? (
            <div className="analytics-view-grid">
              {/* Top 4 Macro KPI Cards */}
              <div className="macro-kpi-row">
                <div className="macro-card">
                  <span className="macro-label">Organization Average Score</span>
                  <div className="macro-val-box">
                    <span className="macro-number" style={{ color: getScoreColor(analyticsData.summary.currentAvgScore) }}>
                      {analyticsData.summary.currentAvgScore}
                    </span>
                    <span className="macro-unit">/100</span>
                  </div>
                  <span className="macro-delta">
                    {analyticsData.summary.scoreDiff >= 0
                      ? `↑ +${analyticsData.summary.scoreDiff} vs ${analyticsData.prevPeriod.periodLabel}`
                      : `↓ ${analyticsData.summary.scoreDiff} vs ${analyticsData.prevPeriod.periodLabel}`}
                  </span>
                </div>

                <div className="macro-card">
                  <span className="macro-label">Completed Deliverables</span>
                  <div className="macro-val-box">
                    <span className="macro-number">{analyticsData.summary.currentTotalCompleted}</span>
                    <span className="macro-unit">Tasks</span>
                  </div>
                  <span className="macro-delta">
                    {analyticsData.summary.completedDiff >= 0
                      ? `+${analyticsData.summary.completedDiff} vs previous period`
                      : `${analyticsData.summary.completedDiff} vs previous period`}
                  </span>
                </div>

                <div className="macro-card">
                  <span className="macro-label">On-Time Submission Rate</span>
                  <div className="macro-val-box">
                    <span className="macro-number">{analyticsData.summary.currentAvgOnTime}%</span>
                  </div>
                  <span className="macro-delta">
                    {analyticsData.summary.onTimeDiff >= 0
                      ? `↑ +${analyticsData.summary.onTimeDiff}% delivery speed`
                      : `↓ ${analyticsData.summary.onTimeDiff}% delivery speed`}
                  </span>
                </div>

                <div className="macro-card">
                  <span className="macro-label">Quality & Approval Score</span>
                  <div className="macro-val-box">
                    <span className="macro-number">{analyticsData.summary.currentAvgQuality}%</span>
                  </div>
                  <span className="macro-delta">
                    {analyticsData.summary.qualityDiff >= 0
                      ? `↑ +${analyticsData.summary.qualityDiff}% first approvals`
                      : `↓ ${analyticsData.summary.qualityDiff}% quality score`}
                  </span>
                </div>
              </div>

              {/* Performance Shift Explanations & Reasons */}
              <div className="perf-reasons-card">
                <div className="reasons-header">
                  <SparklesIcon size={18} className="sparkle-icon-brand" />
                  <h4>Exact Explanations Behind Performance Shift</h4>
                </div>
                <div className="reasons-list">
                  {analyticsData.performanceShiftReasons?.map((reason, idx) => (
                    <div key={idx} className="reason-item">
                      <span className="reason-bullet">✓</span>
                      <p>{reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Performance Breakdown & Comparison */}
              <div className="dept-analytics-card">
                <div className="dept-card-header">
                  <h4>Department Performance Breakdown</h4>
                  <span className="subtext">Ranked by average composite task evaluation score</span>
                </div>
                <div className="dept-breakdown-list">
                  {analyticsData.departmentAnalytics?.map((dept) => (
                    <div key={dept.department} className="dept-row-item">
                      <div className="dept-row-info">
                        <strong>{dept.department}</strong>
                        <small>{dept.employeeCount} Members • {dept.totalCompletedTasks} Completed Deliverables</small>
                      </div>
                      <div className="dept-bar-container">
                        <div
                          className="dept-bar-fill"
                          style={{
                            width: `${dept.avgScore}%`,
                            backgroundColor: getScoreColor(dept.avgScore),
                          }}
                        ></div>
                      </div>
                      <div className="dept-score-badge">
                        <span>{dept.avgScore} pts</span>
                        <small>{dept.avgOnTimeRate}% On-Time</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Performers and Most Improved Highlights */}
              <div className="highlights-split-grid">
                <div className="highlight-box">
                  <div className="highlight-header">
                    <AwardIcon size={16} /> <h5>Top Performers This Period</h5>
                  </div>
                  <div className="highlight-list">
                    {analyticsData.topPerformers?.map((p, i) => (
                      <div
                        key={p.employeeId}
                        className="highlight-row-clickable"
                        onClick={() => {
                          setActiveEmployeeId(p.employeeId);
                          setActiveSubTab('individual');
                        }}
                      >
                        <span className="rank-num">#{i + 1}</span>
                        <div className="p-details">
                          <strong>{p.employeeName}</strong>
                          <small>{p.department} • {p.designation}</small>
                        </div>
                        <span className="p-score-pill" style={{ color: getScoreColor(p.overallScore) }}>
                          {p.overallScore} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="highlight-box">
                  <div className="highlight-header">
                    <TrendingUpIcon size={16} /> <h5>Most Improved Employees</h5>
                  </div>
                  <div className="highlight-list">
                    {analyticsData.mostImproved?.map((p) => (
                      <div
                        key={p.employeeId}
                        className="highlight-row-clickable"
                        onClick={() => {
                          setActiveEmployeeId(p.employeeId);
                          setActiveSubTab('individual');
                        }}
                      >
                        <span className="delta-badge-green">+{p.scoreDelta} pts</span>
                        <div className="p-details">
                          <strong>{p.employeeName}</strong>
                          <small>{p.department} • {p.designation}</small>
                        </div>
                        <span className="p-score-pill">{p.overallScore} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-perf-state">
              <p>No analytics records available for the selected period.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: PERFORMANCE LEADERBOARD ================= */}
      {activeSubTab === 'leaderboard' && (
        <div className="perf-tab-content animate-fade-in">
          {/* Controls & Filter Bar */}
          <div className="leaderboard-controls-card">
            <div className="lb-search-box">
              <SearchIcon size={14} className="search-icon-muted" />
              <input
                type="text"
                placeholder="Search leaderboard by employee name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="lb-filter-group">
              <div className="filter-select-wrap">
                <FilterIcon size={13} className="filter-icon-muted" />
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-select-wrap">
                <span className="filter-label">Sort:</span>
                <select
                  value={leaderboardSort}
                  onChange={(e) => setLeaderboardSort(e.target.value)}
                >
                  <option value="overallScore">Overall Performance Score</option>
                  <option value="completedTasks">Most Completed Tasks</option>
                  <option value="onTimeRate">Highest On-Time Rate</option>
                  <option value="firstAttemptApproval">Highest First-Attempt Approvals</option>
                  <option value="firstSubmissions">Most First Submissions</option>
                  <option value="consistency">Most Consistent Productivity</option>
                  <option value="greatestImprovement">Greatest Improvement (Δ)</option>
                </select>
              </div>

              <button
                type="button"
                className="export-btn-outline"
                onClick={exportLeaderboardCSV}
                title="Export leaderboard to Excel / CSV"
              >
                <DownloadIcon size={14} /> Export CSV
              </button>
            </div>
          </div>

          {/* Leaderboard Table */}
          {loading ? (
            <div className="perf-loading-box">
              <div className="spinner-medium"></div>
              <p>Loading performance leaderboard rankings...</p>
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="empty-perf-state">
              <p>No employee performance records found for this period.</p>
            </div>
          ) : (
            <div className="leaderboard-table-card">
              <table className="perf-leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Employee</th>
                    <th>ID</th>
                    <th>Department & Designation</th>
                    <th>Completed Tasks</th>
                    <th>On-Time Rate</th>
                    <th>Quality & Approvals</th>
                    <th>Score</th>
                    <th>Performance Tier</th>
                    <th>Trend</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData
                    .filter((e) => {
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase().trim();
                        const matchName = e.employeeName?.toLowerCase().includes(q);
                        const matchDesig = e.designation?.toLowerCase().includes(q);
                        if (!matchName && !matchDesig) return false;
                      }
                      return true;
                    })
                    .map((item) => {
                      const scoreColor = getScoreColor(item.overallScore, item.performanceLevel);
                      return (
                        <tr
                          key={item.employeeId}
                          className="leaderboard-row"
                          onClick={() => {
                            setActiveEmployeeId(item.employeeId);
                            setActiveSubTab('individual');
                          }}
                        >
                          <td className="rank-cell">
                            {item.rank === 1 && <span className="medal-pill medal-gold">🥇 1</span>}
                            {item.rank === 2 && <span className="medal-pill medal-silver">🥈 2</span>}
                            {item.rank === 3 && <span className="medal-pill medal-bronze">🥉 3</span>}
                            {item.rank > 3 && <span className="rank-text">#{item.rank}</span>}
                          </td>
                          <td className="emp-name-cell">
                            <div className="avatar-circle">
                              {item.employeeName ? item.employeeName[0].toUpperCase() : 'U'}
                            </div>
                            <div className="emp-names-box">
                              <strong>{item.employeeName}</strong>
                              <span className="emp-email-sub">{item.employeeEmail}</span>
                            </div>
                          </td>
                          <td>
                            <span className="empid-pill">{item.employeeIdNumber || 'NO ID'}</span>
                          </td>
                          <td>
                            <div className="dept-role-box">
                              <span className="dept-label">{item.department || 'General'}</span>
                              <small className="role-label">{item.designation || 'Specialist'}</small>
                            </div>
                          </td>
                          <td>
                            <div className="metric-box-sm">
                              <strong>{item.metrics?.taskCompletion?.totalCompleted ?? 0}</strong>
                              <small>of {item.metrics?.taskCompletion?.totalAssigned ?? 0} ({item.metrics?.taskCompletion?.completionRate ?? 0}%)</small>
                            </div>
                          </td>
                          <td>
                            <div className="metric-box-sm">
                              <strong>{item.metrics?.submissionSpeed?.onTimeRate ?? 0}%</strong>
                              {item.metrics?.firstSubmission?.comparableFirstSubmissionsCount > 0 && (
                                <span className="first-star-pill" title="First submitted among comparable tasks">
                                  ★ {item.metrics.firstSubmission.comparableFirstSubmissionsCount} Firsts
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="metric-box-sm">
                              <strong>{item.metrics?.quality?.firstAttemptApprovedCount ?? 0} Firsts</strong>
                              <small>{item.metrics?.quality?.reworkTotalCount ?? 0} rework cycles</small>
                            </div>
                          </td>
                          <td>
                            <div className="score-pill-box" style={{ borderColor: scoreColor, color: scoreColor }}>
                              {item.hasSufficientData ? item.overallScore : '—'}
                            </div>
                          </td>
                          <td>
                            <span className={`level-badge-table ${getLevelBadgeClass(item.performanceLevel)}`}>
                              {item.performanceLevel}
                            </span>
                          </td>
                          <td>
                            <span className="trend-arrow-box">
                              {item.trend === 'improving' && <span className="green-arrow">↑ +{item.scoreDelta}</span>}
                              {item.trend === 'declining' && <span className="red-arrow">↓ {item.scoreDelta}</span>}
                              {item.trend === 'stable' && <span className="gray-arrow">→ Stable</span>}
                              {item.trend === 'new' && <span className="new-tag">Baseline</span>}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="inspect-btn-mini"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveEmployeeId(item.employeeId);
                                setActiveSubTab('individual');
                              }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: INDIVIDUAL EVALUATION REPORT ================= */}
      {activeSubTab === 'individual' && (
        <div className="perf-tab-content animate-fade-in">
          {loading ? (
            <div className="perf-loading-box">
              <div className="spinner-medium"></div>
              <p>Calculating employee task performance metrics...</p>
            </div>
          ) : individualEval ? (
            <div className="individual-report-wrapper">
              {/* Report Header Card */}
              <div className="report-header-card">
                <div className="report-hero-left">
                  <div className="report-avatar">
                    {individualEval.employeeName ? individualEval.employeeName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="report-title-box">
                    <h3>{individualEval.employeeName}</h3>
                    <p className="report-designation">
                      {individualEval.designation} • {individualEval.department} •{' '}
                      <span className="mono-badge">{individualEval.employeeEmail}</span>
                    </p>
                    <span className="report-period-badge">Evaluation Period: {individualEval.periodLabel}</span>
                  </div>
                </div>

                <div className="report-hero-right">
                  <div className="report-score-indicator">
                    <div
                      className="score-large-circle"
                      style={{
                        borderColor: getScoreColor(individualEval.overallScore, individualEval.performanceLevel),
                        color: getScoreColor(individualEval.overallScore, individualEval.performanceLevel),
                      }}
                    >
                      {individualEval.hasSufficientData ? (
                        <>
                          <span className="large-num">{individualEval.overallScore}</span>
                          <span className="max-num">/100</span>
                        </>
                      ) : (
                        <span className="no-data-dash">—</span>
                      )}
                    </div>
                    <div className="score-details-col">
                      <span className={`level-badge-large ${getLevelBadgeClass(individualEval.performanceLevel)}`}>
                        {individualEval.performanceLevel}
                      </span>
                      {individualEval.hasSufficientData && (
                        <span className="trend-badge-pill">
                          {individualEval.trend === 'improving' && (
                            <span className="trend-up">↑ +{individualEval.scoreDelta} pts vs previous</span>
                          )}
                          {individualEval.trend === 'declining' && (
                            <span className="trend-down">↓ {individualEval.scoreDelta} pts vs previous</span>
                          )}
                          {individualEval.trend === 'stable' && (
                            <span className="trend-stable">→ Stable ({individualEval.scoreDelta} pts)</span>
                          )}
                          {individualEval.trend === 'new' && (
                            <span className="trend-new">★ Baseline Period</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="report-actions-col">
                    <button type="button" className="print-report-btn" onClick={printEvaluationReport}>
                      <DownloadIcon size={14} /> Download / Print Report
                    </button>
                  </div>
                </div>
              </div>

              {/* 6 Performance Pillars Cards */}
              <div className="pillars-summary-grid">
                {/* 1. Task Completion */}
                <div className="pillar-card">
                  <div className="p-header">
                    <strong>Task Completion</strong>
                    <span className="p-badge">25% Weight</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-num">{individualEval.metrics?.taskCompletion?.completionRate ?? 0}%</span>
                    <span className="p-stat-sub">
                      {individualEval.metrics?.taskCompletion?.totalCompleted ?? 0} of{' '}
                      {individualEval.metrics?.taskCompletion?.totalAssigned ?? 0} Assigned
                    </span>
                  </div>
                  <div className="p-sub-row">
                    <span>Submitted: {individualEval.metrics?.taskCompletion?.totalSubmitted ?? 0}</span>
                    <span>Overdue: {individualEval.metrics?.taskCompletion?.totalOverdue ?? 0}</span>
                  </div>
                </div>

                {/* 2. On-Time Delivery */}
                <div className="pillar-card">
                  <div className="p-header">
                    <strong>On-Time Delivery</strong>
                    <span className="p-badge">20% Weight</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-num">{individualEval.metrics?.submissionSpeed?.onTimeRate ?? 0}%</span>
                    <span className="p-stat-sub">
                      {individualEval.metrics?.submissionSpeed?.onTimeCount ?? 0} On-Time ({individualEval.metrics?.submissionSpeed?.earlyCount ?? 0} Early)
                    </span>
                  </div>
                  <div className="p-sub-row">
                    <span>Late: {individualEval.metrics?.submissionSpeed?.lateCount ?? 0}</span>
                    <span>Avg Turnaround: {individualEval.metrics?.submissionSpeed?.avgTurnaroundHours ?? 0}h</span>
                  </div>
                </div>

                {/* 3. Task Quality & First Approval */}
                <div className="pillar-card">
                  <div className="p-header">
                    <strong>Task Quality & Approval</strong>
                    <span className="p-badge">25% Weight</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-num">{individualEval.metrics?.quality?.qualityScore ?? 0}%</span>
                    <span className="p-stat-sub">
                      {individualEval.metrics?.quality?.firstAttemptApprovedCount ?? 0} First-Attempt Approved
                    </span>
                  </div>
                  <div className="p-sub-row">
                    <span>Rework Count: {individualEval.metrics?.quality?.reworkTotalCount ?? 0}</span>
                    <span>Avg Attempts: {individualEval.metrics?.quality?.avgAttemptsBeforeApproval ?? 1}</span>
                  </div>
                </div>

                {/* 4. Productivity Consistency */}
                <div className="pillar-card">
                  <div className="p-header">
                    <strong>Work Consistency</strong>
                    <span className="p-badge">15% Weight</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-num">{individualEval.metrics?.consistency?.consistencyScore ?? 0}%</span>
                    <span className="p-stat-sub">
                      {individualEval.metrics?.consistency?.activeDaysCount ?? 0} Active Days
                    </span>
                  </div>
                  <div className="p-sub-row">
                    <span>Tasks/Day: {individualEval.metrics?.consistency?.tasksPerDay ?? 0}</span>
                    <span>Active Weeks: {individualEval.metrics?.consistency?.weeklyCompletions?.filter((w) => w.count > 0).length ?? 0}</span>
                  </div>
                </div>

                {/* 5. First Submission Recognition */}
                <div className="pillar-card">
                  <div className="p-header">
                    <strong>First Submissions</strong>
                    <span className="p-badge">5% Weight</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-num">
                      {individualEval.metrics?.firstSubmission?.comparableFirstSubmissionsCount ?? 0}
                    </span>
                    <span className="p-stat-sub">Comparable Team Firsts</span>
                  </div>
                  <div className="p-sub-row">
                    <span>Score Contribution: {individualEval.metrics?.firstSubmission?.score ?? 50}%</span>
                  </div>
                </div>

                {/* 6. Workload Management */}
                <div className="pillar-card">
                  <div className="p-header">
                    <strong>Workload Management</strong>
                    <span className="p-badge">10% Weight</span>
                  </div>
                  <div className="p-stat">
                    <span className="p-stat-num">{individualEval.metrics?.workload?.workloadScore ?? 0}%</span>
                    <span className="p-stat-sub">Complexity & Priority Load</span>
                  </div>
                  <div className="p-sub-row">
                    <span>Weighted Volume: {individualEval.metrics?.workload?.completedWeight ?? 0} / {individualEval.metrics?.workload?.totalAssignedWeight ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Weekly Productivity Visual Trend Graph */}
              <div className="visual-trend-card">
                <div className="trend-card-header">
                  <h4>Weekly Output & Productivity Consistency</h4>
                  <span className="subtext">
                    Shows tasks completed week-by-week across {individualEval.periodLabel}
                  </span>
                </div>
                <div className="trend-bars-wrapper">
                  {individualEval.metrics?.consistency?.weeklyCompletions?.length === 0 ? (
                    <p className="no-trend-text">No weekly completion telemetry recorded for this period.</p>
                  ) : (
                    individualEval.metrics?.consistency?.weeklyCompletions?.map((w) => {
                      const maxVal = Math.max(1, ...individualEval.metrics.consistency.weeklyCompletions.map((x) => x.count));
                      const heightPercent = Math.max(12, Math.round((w.count / maxVal) * 100));
                      return (
                        <div key={w.week} className="weekly-bar-column">
                          <span className="bar-count-label">{w.count}</span>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ height: `${heightPercent}%` }}></div>
                          </div>
                          <span className="bar-week-label">{w.week}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Transparent Calculation Breakdown Table */}
              <div className="transparent-calculation-card">
                <div className="calc-card-header">
                  <h4>Transparent Scoring Breakdown & Methodology</h4>
                  <p className="subtext">
                    Score out of 100 is computed strictly from normalized telemetry metrics multiplied by approved weights
                  </p>
                </div>
                <table className="calc-table">
                  <thead>
                    <tr>
                      <th>Metric Category</th>
                      <th>Category Score (0-100)</th>
                      <th>Approved Weight</th>
                      <th>Weighted Contribution</th>
                      <th>Calculation Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Task Completion Rate</td>
                      <td>{individualEval.metrics?.taskCompletion?.score ?? 0} / 100</td>
                      <td>{individualEval.weights?.taskCompletionRate ?? 25}%</td>
                      <td>
                        <strong>
                          {Number((((individualEval.metrics?.taskCompletion?.score ?? 0) * (individualEval.weights?.taskCompletionRate ?? 25)) / 100).toFixed(1))} pts
                        </strong>
                      </td>
                      <td>Completed tasks divided by eligible tasks, adjusted for overdue penalties.</td>
                    </tr>
                    <tr>
                      <td>On-Time Submission Speed</td>
                      <td>{individualEval.metrics?.submissionSpeed?.score ?? 0} / 100</td>
                      <td>{individualEval.weights?.onTimeSubmissionRate ?? 20}%</td>
                      <td>
                        <strong>
                          {Number((((individualEval.metrics?.submissionSpeed?.score ?? 0) * (individualEval.weights?.onTimeSubmissionRate ?? 20)) / 100).toFixed(1))} pts
                        </strong>
                      </td>
                      <td>Submissions verified against server-side timestamps. Manager review delays excluded.</td>
                    </tr>
                    <tr>
                      <td>Task Quality & First Approval</td>
                      <td>{individualEval.metrics?.quality?.qualityScore ?? 0} / 100</td>
                      <td>{individualEval.weights?.taskQualityFirstAttempt ?? 25}%</td>
                      <td>
                        <strong>
                          {Number((((individualEval.metrics?.quality?.qualityScore ?? 0) * (individualEval.weights?.taskQualityFirstAttempt ?? 25)) / 100).toFixed(1))} pts
                        </strong>
                      </td>
                      <td>Rewards first-attempt approvals with 0 revisions. Penalizes excessive rework cycles.</td>
                    </tr>
                    <tr>
                      <td>Productivity & Consistency</td>
                      <td>{individualEval.metrics?.consistency?.consistencyScore ?? 0} / 100</td>
                      <td>{individualEval.weights?.productivityConsistency ?? 15}%</td>
                      <td>
                        <strong>
                          {Number((((individualEval.metrics?.consistency?.consistencyScore ?? 0) * (individualEval.weights?.productivityConsistency ?? 15)) / 100).toFixed(1))} pts
                        </strong>
                      </td>
                      <td>Measures continuous delivery across working weeks rather than sporadic bursts.</td>
                    </tr>
                    <tr>
                      <td>Comparable First Submissions</td>
                      <td>{individualEval.metrics?.firstSubmission?.score ?? 50} / 100</td>
                      <td>{individualEval.weights?.comparableFirstSubmission ?? 5}%</td>
                      <td>
                        <strong>
                          {Number((((individualEval.metrics?.firstSubmission?.score ?? 50) * (individualEval.weights?.comparableFirstSubmission ?? 5)) / 100).toFixed(1))} pts
                        </strong>
                      </td>
                      <td>First to submit assigned work among comparable tasks in project milestones.</td>
                    </tr>
                    <tr>
                      <td>Workload Management</td>
                      <td>{individualEval.metrics?.workload?.workloadScore ?? 0} / 100</td>
                      <td>{individualEval.weights?.workloadManagement ?? 10}%</td>
                      <td>
                        <strong>
                          {Number((((individualEval.metrics?.workload?.workloadScore ?? 0) * (individualEval.weights?.workloadManagement ?? 10)) / 100).toFixed(1))} pts
                        </strong>
                      </td>
                      <td>Weighted volume factoring in high/urgent task priority and complex assignments.</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="2">
                        <strong>Total Overall Score</strong>
                      </td>
                      <td>
                        <strong>100%</strong>
                      </td>
                      <td>
                        <strong className="grand-total-score">
                          {individualEval.hasSufficientData ? `${individualEval.overallScore} / 100` : 'Insufficient Data'}
                        </strong>
                      </td>
                      <td>
                        <span className={`level-badge ${getLevelBadgeClass(individualEval.performanceLevel)}`}>
                          {individualEval.performanceLevel}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-perf-state">
              <p>No evaluation available for this employee in the selected period.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: AUDITED TASK RECORDS ================= */}
      {activeSubTab === 'audited-tasks' && (
        <div className="perf-tab-content animate-fade-in">
          {individualEval?.tasksAudited?.length === 0 ? (
            <div className="empty-perf-state">
              <p>No audited task records found for this employee in {individualEval.periodLabel}.</p>
            </div>
          ) : (
            <div className="audited-tasks-card">
              <div className="audited-card-header">
                <div>
                  <h4>Audited Task Records for {individualEval?.employeeName}</h4>
                  <p className="subtext">
                    All contributing database submissions with timestamps, on-time indicators, and review audit history
                  </p>
                </div>
              </div>

              <div className="table-responsive-box">
                <table className="eval-audit-table">
                  <thead>
                    <tr>
                      <th>Task Title</th>
                      <th>Priority</th>
                      <th>Deadline</th>
                      <th>Submitted Date</th>
                      <th>Approved Date</th>
                      <th>On-Time Status</th>
                      <th>Submission Attempts</th>
                      <th>Quality Outcome</th>
                      <th>Manager Review Delay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individualEval?.tasksAudited?.map((t) => (
                      <tr key={t.taskId || t.title}>
                        <td className="task-title-cell">
                          <strong>{t.title}</strong>
                          {t.isFirstSubmission && (
                            <span className="first-badge-tag" title="First to submit among comparable tasks">
                              ★ First Submitted
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`priority-pill priority-${(t.priority || 'medium').toLowerCase()}`}>
                            {t.priority || 'medium'}
                          </span>
                        </td>
                        <td>{t.deadline || 'No deadline'}</td>
                        <td>
                          {t.submittedAt ? (
                            new Date(t.submittedAt).toLocaleDateString()
                          ) : (
                            <span className="text-muted">Not submitted</span>
                          )}
                        </td>
                        <td>
                          {t.approvedAt ? (
                            new Date(t.approvedAt).toLocaleDateString()
                          ) : (
                            <span className="text-muted">Pending approval</span>
                          )}
                        </td>
                        <td>
                          {t.isOnTime === true && (
                            <span className="status-badge-inline status-green">✓ On Time</span>
                          )}
                          {t.isOnTime === false && (
                            <span className="status-badge-inline status-red">✗ Overdue / Late</span>
                          )}
                          {t.isOnTime === null && (
                            <span className="status-badge-inline status-gray">Pending</span>
                          )}
                        </td>
                        <td>
                          {t.reworkCount > 0 ? (
                            <span className="rework-tag-alert">{t.reworkCount} Revisions Needed</span>
                          ) : (
                            <span className="rework-tag-clean">1st Attempt Approved</span>
                          )}
                        </td>
                        <td>
                          {t.isFirstAttemptApproved ? (
                            <span className="status-badge-inline status-green">✓ 1st Attempt Quality</span>
                          ) : t.status === 'completed' ? (
                            <span className="status-badge-inline status-blue">✓ Approved</span>
                          ) : (
                            <span className="status-badge-inline status-gray">{t.status}</span>
                          )}
                        </td>
                        <td>
                          <span className="review-delay-tag">
                            {t.reviewDurationHours}h (excluded from worker score)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: ADMIN SCORING WEIGHTS CONFIGURATION ================= */}
      {isConfigModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsConfigModalOpen(false)}>
          <div className="modal-card perf-config-modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <SettingsIcon size={18} />
                <h3>Configure Performance Evaluation Weights</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsConfigModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="modal-form">
              <p className="config-help-text">
                Customize the percentage weights assigned to each of the 6 performance categories.
                The sum of all weights must equal exactly 100%.
              </p>

              {configSuccessMessage && (
                <div className="config-success-banner">
                  <CheckCircleIcon size={16} /> {configSuccessMessage}
                </div>
              )}

              <div className="weights-form-grid">
                <div className="form-group">
                  <label>1. Task Completion Rate Weight (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsConfig.taskCompletionRate}
                    onChange={(e) =>
                      setWeightsConfig({ ...weightsConfig, taskCompletionRate: Number(e.target.value) })
                    }
                    required
                  />
                  <small className="help-text">Ratio of completed tasks vs total assigned tasks</small>
                </div>

                <div className="form-group">
                  <label>2. On-Time Submission Rate Weight (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsConfig.onTimeSubmissionRate}
                    onChange={(e) =>
                      setWeightsConfig({ ...weightsConfig, onTimeSubmissionRate: Number(e.target.value) })
                    }
                    required
                  />
                  <small className="help-text">Submissions delivered on or before official deadlines</small>
                </div>

                <div className="form-group">
                  <label>3. Task Quality & First-Attempt Approval (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsConfig.taskQualityFirstAttempt}
                    onChange={(e) =>
                      setWeightsConfig({ ...weightsConfig, taskQualityFirstAttempt: Number(e.target.value) })
                    }
                    required
                  />
                  <small className="help-text">Approval on first submission with minimal rework</small>
                </div>

                <div className="form-group">
                  <label>4. Productivity & Work Consistency (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsConfig.productivityConsistency}
                    onChange={(e) =>
                      setWeightsConfig({ ...weightsConfig, productivityConsistency: Number(e.target.value) })
                    }
                    required
                  />
                  <small className="help-text">Regularity of output across working weeks and active days</small>
                </div>

                <div className="form-group">
                  <label>5. Comparable First Submissions (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsConfig.comparableFirstSubmission}
                    onChange={(e) =>
                      setWeightsConfig({ ...weightsConfig, comparableFirstSubmission: Number(e.target.value) })
                    }
                    required
                  />
                  <small className="help-text">Submitting first among peer tasks with similar scope</small>
                </div>

                <div className="form-group">
                  <label>6. Workload Management (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsConfig.workloadManagement}
                    onChange={(e) =>
                      setWeightsConfig({ ...weightsConfig, workloadManagement: Number(e.target.value) })
                    }
                    required
                  />
                  <small className="help-text">Volume handling factoring in high/urgent task priority</small>
                </div>
              </div>

              <div className="weights-total-summary">
                <span>Total Weight:</span>
                <strong
                  style={{
                    color:
                      Number(weightsConfig.taskCompletionRate) +
                        Number(weightsConfig.onTimeSubmissionRate) +
                        Number(weightsConfig.taskQualityFirstAttempt) +
                        Number(weightsConfig.productivityConsistency) +
                        Number(weightsConfig.comparableFirstSubmission) +
                        Number(weightsConfig.workloadManagement) ===
                      100
                        ? '#10b981'
                        : '#ef4444',
                  }}
                >
                  {Number(weightsConfig.taskCompletionRate) +
                    Number(weightsConfig.onTimeSubmissionRate) +
                    Number(weightsConfig.taskQualityFirstAttempt) +
                    Number(weightsConfig.productivityConsistency) +
                    Number(weightsConfig.comparableFirstSubmission) +
                    Number(weightsConfig.workloadManagement)}
                  % (Must be exactly 100%)
                </strong>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsConfigModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingConfig}>
                  {savingConfig ? 'Saving Configuration...' : 'Save & Recalculate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
