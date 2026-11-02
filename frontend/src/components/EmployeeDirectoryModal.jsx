import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  SearchIcon,
  FilterIcon,
  XIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  AwardIcon,
  BarChartIcon,
  FileTextIcon,
  DownloadIcon,
  UserIcon,
  ChevronRightIcon,
  SparklesIcon,
} from './Icons';

export const EmployeeDirectoryModal = ({
  isOpen = false,
  onClose,
  initialEmployeeId = null,
  onSelectEmployeeForEvaluation,
}) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [periodType, setPeriodType] = useState('month');
  const [periodValue, setPeriodValue] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeEvaluation, setEmployeeEvaluation] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDirectory();
    }
  }, [isOpen, periodType, periodValue]);

  useEffect(() => {
    if (initialEmployeeId && employees.length > 0) {
      const target = employees.find((e) => String(e._id) === String(initialEmployeeId));
      if (target) {
        inspectEmployeePerformance(target);
      }
    }
  }, [initialEmployeeId, employees]);

  const loadDirectory = async () => {
    try {
      setLoading(true);
      const res = await api.getPerformanceDirectory({ periodType, periodValue });
      if (res && res.directory) {
        setEmployees(res.directory);
      }
    } catch (err) {
      console.error('Failed to load performance directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const inspectEmployeePerformance = async (emp) => {
    setSelectedEmployee(emp);
    try {
      setEvalLoading(true);
      const res = await api.getEmployeePerformanceEvaluation(emp._id, { periodType, periodValue });
      if (res && res.evaluation) {
        setEmployeeEvaluation(res.evaluation);
      }
    } catch (err) {
      console.error('Failed to fetch employee evaluation:', err);
    } finally {
      setEvalLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    if (departmentFilter !== 'all' && emp.department !== departmentFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = emp.name?.toLowerCase().includes(q);
      const matchEmail = emp.email?.toLowerCase().includes(q);
      const matchId = emp.employeeId?.toLowerCase().includes(q);
      const matchDept = emp.department?.toLowerCase().includes(q);
      const matchDesig = emp.designation?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchId && !matchDept && !matchDesig) {
        return false;
      }
    }
    return true;
  });

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

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

  const exportDirectoryToCSV = () => {
    if (!employees || employees.length === 0) return;
    const headers = [
      'Employee Name',
      'Employee ID',
      'Email',
      'Department',
      'Designation',
      'Overall Performance Score',
      'Performance Level',
      'Trend',
      'Task Completion Rate (%)',
      'On-Time Submission Rate (%)',
      'Total Completed Tasks',
      'First Submission Achievements',
    ];

    const rows = filteredEmployees.map((e) => [
      `"${e.name || ''}"`,
      `"${e.employeeId || ''}"`,
      `"${e.email || ''}"`,
      `"${e.department || 'General'}"`,
      `"${e.designation || 'Specialist'}"`,
      e.hasSufficientData ? e.overallScore : 'N/A',
      `"${e.performanceLevel || 'Insufficient Data'}"`,
      `"${e.trend || 'stable'}"`,
      e.metrics?.completionRate ?? 'N/A',
      e.metrics?.onTimeRate ?? 'N/A',
      e.metrics?.totalCompleted ?? 0,
      e.metrics?.firstSubmissionCount ?? 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TaskFlow_Employee_Directory_Performance_${periodType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="modal-card employee-directory-modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="directory-modal-header">
          <div className="header-title-box">
            <div className="header-badge-icon">
              <AwardIcon size={20} />
            </div>
            <div>
              <h3>Employee Directory & Performance Registry</h3>
              <p className="header-subtitle">
                Comprehensive personnel profiles with real task activities, automated ratings, and audit histories
              </p>
            </div>
          </div>
          <div className="header-actions-box">
            <button
              type="button"
              className="export-btn-outline"
              onClick={exportDirectoryToCSV}
              title="Export complete directory performance to Excel / CSV"
            >
              <DownloadIcon size={14} /> Export CSV
            </button>
            <button type="button" className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        {/* Modal Controls Bar */}
        <div className="directory-controls-bar">
          <div className="directory-search-input-wrap">
            <SearchIcon size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder="Search by employee name, email, employee ID, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="directory-filter-row">
            <div className="filter-dropdown-wrap">
              <FilterIcon size={13} className="filter-icon-muted" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">All Departments ({employees.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="period-tabs-inline">
              <button
                type="button"
                className={`period-tab-mini ${periodType === 'month' ? 'active' : ''}`}
                onClick={() => setPeriodType('month')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`period-tab-mini ${periodType === 'quarter' ? 'active' : ''}`}
                onClick={() => setPeriodType('quarter')}
              >
                Quarterly
              </button>
              <button
                type="button"
                className={`period-tab-mini ${periodType === 'half-year' ? 'active' : ''}`}
                onClick={() => setPeriodType('half-year')}
              >
                Half-Yearly
              </button>
              <button
                type="button"
                className={`period-tab-mini ${periodType === 'year' ? 'active' : ''}`}
                onClick={() => setPeriodType('year')}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="directory-modal-body">
          {selectedEmployee ? (
            /* ================= SINGLE EMPLOYEE DETAILED PERFORMANCE VIEW ================= */
            <div className="single-employee-detail-panel animate-fade-in">
              <div className="detail-panel-top-nav">
                <button
                  type="button"
                  className="back-to-directory-btn"
                  onClick={() => {
                    setSelectedEmployee(null);
                    setEmployeeEvaluation(null);
                  }}
                >
                  ← Back to Employee Directory
                </button>
                {onSelectEmployeeForEvaluation && (
                  <button
                    type="button"
                    className="open-full-analytics-btn"
                    onClick={() => {
                      onSelectEmployeeForEvaluation(selectedEmployee._id);
                      onClose();
                    }}
                  >
                    Open in Full Performance View <ChevronRightIcon size={14} />
                  </button>
                )}
              </div>

              {evalLoading ? (
                <div className="eval-loading-state">
                  <div className="spinner-medium"></div>
                  <p>Calculating live task-based performance metrics for {selectedEmployee.name}...</p>
                </div>
              ) : employeeEvaluation ? (
                <div className="employee-eval-content">
                  {/* Employee Identity Hero */}
                  <div className="eval-identity-hero">
                    <div className="hero-avatar">
                      {selectedEmployee.name ? selectedEmployee.name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="hero-meta">
                      <h4>{employeeEvaluation.employeeName}</h4>
                      <p className="hero-subtext">
                        {employeeEvaluation.designation} • {employeeEvaluation.department} •{' '}
                        <span className="mono-badge">{selectedEmployee.employeeId}</span>
                      </p>
                      <span className="hero-period-pill">{employeeEvaluation.periodLabel}</span>
                    </div>

                    <div className="hero-score-badge-box">
                      <div
                        className="hero-score-circle"
                        style={{
                          borderColor: getScoreColor(
                            employeeEvaluation.overallScore,
                            employeeEvaluation.performanceLevel
                          ),
                          color: getScoreColor(
                            employeeEvaluation.overallScore,
                            employeeEvaluation.performanceLevel
                          ),
                        }}
                      >
                        {employeeEvaluation.hasSufficientData ? (
                          <>
                            <span className="score-num">{employeeEvaluation.overallScore}</span>
                            <span className="score-max">/100</span>
                          </>
                        ) : (
                          <span className="score-insufficient">—</span>
                        )}
                      </div>
                      <div className="hero-level-info">
                        <span className={`level-badge ${getLevelBadgeClass(employeeEvaluation.performanceLevel)}`}>
                          {employeeEvaluation.performanceLevel}
                        </span>
                        {employeeEvaluation.hasSufficientData && (
                          <span className="trend-badge-pill">
                            {employeeEvaluation.trend === 'improving' && (
                              <span className="trend-up">↑ +{employeeEvaluation.scoreDelta} vs previous</span>
                            )}
                            {employeeEvaluation.trend === 'declining' && (
                              <span className="trend-down">↓ {employeeEvaluation.scoreDelta} vs previous</span>
                            )}
                            {employeeEvaluation.trend === 'stable' && (
                              <span className="trend-stable">→ Stable ({employeeEvaluation.scoreDelta} pts)</span>
                            )}
                            {employeeEvaluation.trend === 'new' && (
                              <span className="trend-new">★ Baseline</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 6 Key Performance Pillar Cards */}
                  <div className="eval-pillars-grid">
                    {/* Pillar 1: Task Completion (25%) */}
                    <div className="pillar-metric-card">
                      <div className="pillar-header">
                        <span className="pillar-title">Task Completion</span>
                        <span className="pillar-weight-badge">Weight: 25%</span>
                      </div>
                      <div className="pillar-main-stat">
                        <span className="stat-large">{employeeEvaluation.metrics.taskCompletion.completionRate}%</span>
                        <span className="stat-label">
                          {employeeEvaluation.metrics.taskCompletion.totalCompleted} of{' '}
                          {employeeEvaluation.metrics.taskCompletion.totalAssigned} Tasks
                        </span>
                      </div>
                      <div className="pillar-substats-row">
                        <span>Submitted: {employeeEvaluation.metrics.taskCompletion.totalSubmitted}</span>
                        <span>Overdue: {employeeEvaluation.metrics.taskCompletion.totalOverdue}</span>
                      </div>
                    </div>

                    {/* Pillar 2: On-Time Submission (20%) */}
                    <div className="pillar-metric-card">
                      <div className="pillar-header">
                        <span className="pillar-title">On-Time Delivery</span>
                        <span className="pillar-weight-badge">Weight: 20%</span>
                      </div>
                      <div className="pillar-main-stat">
                        <span className="stat-large">{employeeEvaluation.metrics.submissionSpeed.onTimeRate}%</span>
                        <span className="stat-label">
                          {employeeEvaluation.metrics.submissionSpeed.onTimeCount} On-Time ({employeeEvaluation.metrics.submissionSpeed.earlyCount} Early)
                        </span>
                      </div>
                      <div className="pillar-substats-row">
                        <span>Late: {employeeEvaluation.metrics.submissionSpeed.lateCount}</span>
                        <span>Avg Turnaround: {employeeEvaluation.metrics.submissionSpeed.avgTurnaroundHours}h</span>
                      </div>
                    </div>

                    {/* Pillar 3: Quality & First-Attempt (25%) */}
                    <div className="pillar-metric-card">
                      <div className="pillar-header">
                        <span className="pillar-title">Task Quality & Approval</span>
                        <span className="pillar-weight-badge">Weight: 25%</span>
                      </div>
                      <div className="pillar-main-stat">
                        <span className="stat-large">{employeeEvaluation.metrics.quality.qualityScore}%</span>
                        <span className="stat-label">
                          {employeeEvaluation.metrics.quality.firstAttemptApprovedCount} First-Attempt Approved
                        </span>
                      </div>
                      <div className="pillar-substats-row">
                        <span>Rework Cycles: {employeeEvaluation.metrics.quality.reworkTotalCount}</span>
                        <span>Avg Attempts: {employeeEvaluation.metrics.quality.avgAttemptsBeforeApproval}</span>
                      </div>
                    </div>

                    {/* Pillar 4: Productivity & Consistency (15%) */}
                    <div className="pillar-metric-card">
                      <div className="pillar-header">
                        <span className="pillar-title">Productivity & Consistency</span>
                        <span className="pillar-weight-badge">Weight: 15%</span>
                      </div>
                      <div className="pillar-main-stat">
                        <span className="stat-large">{employeeEvaluation.metrics.consistency.consistencyScore}%</span>
                        <span className="stat-label">
                          {employeeEvaluation.metrics.consistency.activeDaysCount} Active Working Days
                        </span>
                      </div>
                      <div className="pillar-substats-row">
                        <span>Tasks / Day: {employeeEvaluation.metrics.consistency.tasksPerDay}</span>
                        <span>Active Weeks: {employeeEvaluation.metrics.consistency.weeklyCompletions.filter((w) => w.count > 0).length}</span>
                      </div>
                    </div>

                    {/* Pillar 5: First Submission Recognition (5%) */}
                    <div className="pillar-metric-card">
                      <div className="pillar-header">
                        <span className="pillar-title">First Submissions</span>
                        <span className="pillar-weight-badge">Weight: 5%</span>
                      </div>
                      <div className="pillar-main-stat">
                        <span className="stat-large">
                          {employeeEvaluation.metrics.firstSubmission.comparableFirstSubmissionsCount}
                        </span>
                        <span className="stat-label">Comparable Team Firsts</span>
                      </div>
                      <div className="pillar-substats-row">
                        <span>Score Contribution: {employeeEvaluation.metrics.firstSubmission.score}%</span>
                      </div>
                    </div>

                    {/* Pillar 6: Workload Management (10%) */}
                    <div className="pillar-metric-card">
                      <div className="pillar-header">
                        <span className="pillar-title">Workload Management</span>
                        <span className="pillar-weight-badge">Weight: 10%</span>
                      </div>
                      <div className="pillar-main-stat">
                        <span className="stat-large">{employeeEvaluation.metrics.workload.workloadScore}%</span>
                        <span className="stat-label">Complexity & Priority Volume</span>
                      </div>
                      <div className="pillar-substats-row">
                        <span>Weighted Work: {employeeEvaluation.metrics.workload.completedWeight} / {employeeEvaluation.metrics.workload.totalAssignedWeight}</span>
                      </div>
                    </div>
                  </div>

                  {/* Task Audit History Table */}
                  <div className="eval-audit-history-box">
                    <div className="audit-header-bar">
                      <div>
                        <h5>Contributing Task Records ({employeeEvaluation.tasksAudited?.length || 0})</h5>
                        <p className="audit-subtitle">
                          Every score is 100% transparent and calculated directly from genuine database submissions
                        </p>
                      </div>
                    </div>

                    {employeeEvaluation.tasksAudited?.length === 0 ? (
                      <div className="empty-audit-state">
                        <p>No active tasks recorded during this period.</p>
                      </div>
                    ) : (
                      <div className="audit-table-wrap">
                        <table className="eval-audit-table">
                          <thead>
                            <tr>
                              <th>Task Title</th>
                              <th>Priority</th>
                              <th>Deadline</th>
                              <th>Submitted Date</th>
                              <th>On-Time Status</th>
                              <th>Attempts / Rework</th>
                              <th>Quality Result</th>
                              <th>Review Delay Excluded</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employeeEvaluation.tasksAudited.map((t) => (
                              <tr key={t.taskId || t.title}>
                                <td className="task-title-cell">
                                  <strong>{t.title}</strong>
                                  {t.isFirstSubmission && (
                                    <span className="first-badge-tag" title="First submitted among comparable tasks!">
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
                                  {t.submittedAt
                                    ? new Date(t.submittedAt).toLocaleDateString()
                                    : <span className="text-muted">Not submitted</span>}
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
                                    <span className="rework-tag-alert">{t.reworkCount} Revisions</span>
                                  ) : (
                                    <span className="rework-tag-clean">1st Attempt</span>
                                  )}
                                </td>
                                <td>
                                  {t.isFirstAttemptApproved ? (
                                    <span className="status-badge-inline status-green">✓ Approved 1st Attempt</span>
                                  ) : t.status === 'completed' ? (
                                    <span className="status-badge-inline status-blue">✓ Approved (Post-Revision)</span>
                                  ) : (
                                    <span className="status-badge-inline status-gray">{t.status}</span>
                                  )}
                                </td>
                                <td>
                                  <span className="review-delay-tag" title="Manager review time is excluded so employees are never penalized">
                                    {t.reviewDurationHours}h manager review
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            /* ================= DIRECTORY TABLE LIST VIEW ================= */
            <div className="directory-table-container">
              {loading ? (
                <div className="directory-loading-state">
                  <div className="spinner-medium"></div>
                  <p>Loading employee profiles & calculating automated performance metrics...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="directory-empty-state">
                  <UserIcon size={36} className="empty-icon-muted" />
                  <h4>No Employee Records Found</h4>
                  <p>Try adjusting your search criteria or department filter.</p>
                </div>
              ) : (
                <table className="directory-master-table">
                  <thead>
                    <tr>
                      <th>Employee Name & Contact</th>
                      <th>Employee ID</th>
                      <th>Department & Role</th>
                      <th>Completion Rate</th>
                      <th>On-Time Rate</th>
                      <th>First Approvals</th>
                      <th>Performance Score</th>
                      <th>Performance Tier</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => {
                      const scoreColor = getScoreColor(emp.overallScore, emp.performanceLevel);
                      return (
                        <tr
                          key={emp._id}
                          className="directory-data-row"
                          onClick={() => inspectEmployeePerformance(emp)}
                        >
                          <td className="emp-profile-cell">
                            <div className="avatar-circle">
                              {emp.name ? emp.name[0].toUpperCase() : 'U'}
                            </div>
                            <div className="emp-text-details">
                              <strong className="emp-name-text">{emp.name}</strong>
                              <span className="emp-email-text">{emp.email}</span>
                            </div>
                          </td>
                          <td>
                            <span className="empid-badge-tag">{emp.employeeId || 'NO ID'}</span>
                          </td>
                          <td>
                            <div className="dept-role-box">
                              <span className="dept-label">{emp.department || 'General'}</span>
                              <small className="role-label">{emp.designation || 'Specialist'}</small>
                            </div>
                          </td>
                          <td>
                            <div className="rate-cell-box">
                              <strong>{emp.metrics?.completionRate ?? 0}%</strong>
                              <small>{emp.metrics?.totalCompleted ?? 0} done</small>
                            </div>
                          </td>
                          <td>
                            <div className="rate-cell-box">
                              <strong>{emp.metrics?.onTimeRate ?? 0}%</strong>
                              {emp.metrics?.firstSubmissionCount > 0 && (
                                <span className="first-star-pill" title={`${emp.metrics.firstSubmissionCount} First Submissions`}>
                                  ★ {emp.metrics.firstSubmissionCount}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="quality-points-pill">
                              {emp.metrics?.qualityScore ?? 0}% quality
                            </span>
                          </td>
                          <td>
                            <div className="score-cell-indicator">
                              <div
                                className="score-mini-circle"
                                style={{ borderColor: scoreColor, color: scoreColor }}
                              >
                                {emp.hasSufficientData ? emp.overallScore : '—'}
                              </div>
                              {emp.hasSufficientData && (
                                <span className="trend-arrow">
                                  {emp.trend === 'improving' && <span className="green-arrow">↑</span>}
                                  {emp.trend === 'declining' && <span className="red-arrow">↓</span>}
                                  {emp.trend === 'stable' && <span className="gray-arrow">→</span>}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`level-badge-table ${getLevelBadgeClass(emp.performanceLevel)}`}>
                              {emp.performanceLevel}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="inspect-btn-mini"
                              onClick={(e) => {
                                e.stopPropagation();
                                inspectEmployeePerformance(emp);
                              }}
                              title="Inspect full performance and audit history"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
