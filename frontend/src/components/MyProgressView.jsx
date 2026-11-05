import React, { useState, useEffect } from 'react';
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
} from './Icons';
import { api } from '../services/api';
import { CertificateModal } from './CertificateModal';

export const MyProgressView = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('analytics'); // 'analytics' | 'projects' | 'reviews' | 'self_eval'
  const [viewMode, setViewMode] = useState('personal'); // 'personal' | 'reports'

  // Progress Data
  const [progressData, setProgressData] = useState(null);
  const [directReports, setDirectReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reportProgressData, setReportProgressData] = useState(null);
  const [reportSearchQuery, setReportSearchQuery] = useState('');

  // Modals state
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isSelfEvalModalOpen, setIsSelfEvalModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certModalData, setCertModalData] = useState({});

  // Recognition & Awards state
  const [awards, setAwards] = useState([]);
  const [nomineesData, setNomineesData] = useState(null);
  const [reportSubMode, setReportSubMode] = useState('subordinates'); // 'subordinates' | 'recognition_board'
  const [nomineePeriodType, setNomineePeriodType] = useState('month'); // 'month' | 'year'

  // Active items for modals
  const [activeRatingForAction, setActiveRatingForAction] = useState(null);
  const [activeMilestoneForNote, setActiveMilestoneForNote] = useState(null);
  const [targetEmployeeForRate, setTargetEmployeeForRate] = useState(null);

  // Form states
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

  const [disputeForm, setDisputeForm] = useState({
    reason: 'Score discrepancy based on delivered deliverables',
    employeeNotes: '',
  });

  const [resolveForm, setResolveForm] = useState({
    resolutionStatus: 'reviewed',
    resolutionNotes: '',
    adjustScores: false,
    qualityOfWork: 4,
    timeliness: 4,
    initiative: 4,
    collaboration: 4,
  });

  const [noteForm, setNoteForm] = useState({
    note: '',
  });

  // Load recognition awards and nominees
  const loadAwards = async () => {
    try {
      const res = await api.getRecognitionAwards();
      setAwards(res.awards || []);
    } catch (err) {
      console.warn('Failed to load recognition awards:', err);
    }
  };

  const loadNominees = async (type = nomineePeriodType) => {
    try {
      const res = await api.getRecognitionNominees('', type);
      setNomineesData(res);
    } catch (err) {
      console.warn('Failed to load nominees:', err);
    }
  };

  // Load user personal progress
  const loadProgressData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getMyProgress();
      setProgressData(data);

      await loadAwards();

      if (data.canRateOthers) {
        const reports = await api.getDirectReports();
        setDirectReports(reports);
        await loadNominees(nomineePeriodType);
      }
    } catch (err) {
      console.error('Failed to load progress data:', err);
      setError(err.message || 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgressData();
  }, []);

  // Load progress for a specific report
  const loadReportProgress = async (empId) => {
    try {
      setLoading(true);
      const data = await api.getEmployeeProgress(empId);
      setReportProgressData(data);
      setSelectedReportId(empId);
    } catch (err) {
      console.error('Failed to load report progress:', err);
      alert(err.message || 'Failed to load employee progress');
    } finally {
      setLoading(false);
    }
  };

  // Determine active dataset (either personal or inspected direct report)
  const activeData = selectedReportId && reportProgressData ? reportProgressData : progressData;

  // Handle Rate Employee Submit
  const handleRateSubmit = async (e) => {
    e.preventDefault();
    if (!targetEmployeeForRate) return;

    try {
      await api.submitPerformanceRating({
        employeeId: targetEmployeeForRate.id || targetEmployeeForRate._id,
        period: rateForm.period,
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

      if (selectedReportId) {
        await loadReportProgress(selectedReportId);
      }
      await loadProgressData();
      alert('Performance rating submitted successfully!');
    } catch (err) {
      alert(err.message || 'Failed to submit rating');
    }
  };

  // Handle Self-Evaluation Submit
  const handleSelfEvalSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.submitSelfEvaluation({
        period: selfEvalForm.period,
        qualityOfWork: Number(selfEvalForm.qualityOfWork),
        timeliness: Number(selfEvalForm.timeliness),
        initiative: Number(selfEvalForm.initiative),
        collaboration: Number(selfEvalForm.collaboration),
        strengths: selfEvalForm.strengthsText.split(',').map((s) => s.trim()).filter(Boolean),
        areasForImprovement: selfEvalForm.areasText.split(',').map((s) => s.trim()).filter(Boolean),
        comments: selfEvalForm.comments,
      });

      setIsSelfEvalModalOpen(false);
      await loadProgressData();
      alert('Self-evaluation submitted successfully!');
    } catch (err) {
      alert(err.message || 'Failed to submit self-evaluation');
    }
  };

  // Handle Dispute Submit
  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!activeRatingForAction) return;

    try {
      await api.disputeRating({
        ratingId: activeRatingForAction._id,
        reason: disputeForm.reason,
        employeeNotes: disputeForm.employeeNotes,
      });

      setIsDisputeModalOpen(false);
      setDisputeForm({
        reason: 'Score discrepancy based on delivered deliverables',
        employeeNotes: '',
      });
      await loadProgressData();
      alert('Review / dispute request submitted to your superior and administrator.');
    } catch (err) {
      alert(err.message || 'Failed to submit dispute');
    }
  };

  // Handle Resolve Dispute Submit
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!activeRatingForAction) return;

    try {
      const payload = {
        ratingId: activeRatingForAction._id,
        resolutionStatus: resolveForm.resolutionStatus,
        resolutionNotes: resolveForm.resolutionNotes,
      };

      if (resolveForm.adjustScores) {
        payload.adjustedScores = {
          qualityOfWork: Number(resolveForm.qualityOfWork),
          timeliness: Number(resolveForm.timeliness),
          initiative: Number(resolveForm.initiative),
          collaboration: Number(resolveForm.collaboration),
        };
      }

      await api.resolveRatingDispute(payload);
      setIsResolveModalOpen(false);
      if (selectedReportId) {
        await loadReportProgress(selectedReportId);
      }
      await loadProgressData();
      alert('Rating dispute resolved successfully.');
    } catch (err) {
      alert(err.message || 'Failed to resolve dispute');
    }
  };

  // Handle Add Progress Note Submit
  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!activeMilestoneForNote || !noteForm.note.trim()) return;

    try {
      await api.addMilestoneProgressNote({
        projectId: activeMilestoneForNote.projectId,
        milestoneId: activeMilestoneForNote.id || activeMilestoneForNote._id,
        note: noteForm.note.trim(),
      });

      setIsNoteModalOpen(false);
      setNoteForm({ note: '' });
      await loadProgressData();
      if (selectedReportId) {
        await loadReportProgress(selectedReportId);
      }
      alert('Progress note added to milestone.');
    } catch (err) {
      alert(err.message || 'Failed to add progress note');
    }
  };

  if (loading && !progressData) {
    return (
      <div className="progress-loading-wrap">
        <div className="progress-spinner" />
        <p>Loading personal performance & progress telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-error-wrap">
        <AlertTriangleIcon size={32} />
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={loadProgressData}>
          Retry
        </button>
      </div>
    );
  }

  const emp = activeData?.employee || user;
  const aggregate = activeData?.aggregate || {};
  const stats = activeData?.milestoneStats || { total: 0, completed: 0, inProgress: 0, overdue: 0, onTimeRate: 100 };
  const assignedProjects = activeData?.assignedProjects || [];
  const approvedProjects = activeData?.approvedProjects || [];
  const ratings = activeData?.ratings || [];
  const selfEvaluations = activeData?.selfEvaluations || [];
  const trends = activeData?.trends || [];

  const filteredDirectReports = directReports.filter((r) =>
    r.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
    r.designation.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
    r.department.toLowerCase().includes(reportSearchQuery.toLowerCase())
  );

  return (
    <div className="progress-module-container animate-fade-in">
      {/* HEADER BAR */}
      <div className="progress-header-bar">
        <div className="progress-title-meta">
          <div className="progress-icon-badge">
            <TrendingUpIcon size={22} />
          </div>
          <div>
            <h2 className="progress-main-title">
              {viewMode === 'reports' && selectedReportId ? `${emp.name}'s Progress & Ratings` : 'My Progress & Performance'}
            </h2>
            <p className="progress-subtitle">
              {emp.designation} • {emp.department} • Tier Level {emp.hierarchyLevel}
            </p>
          </div>
        </div>

        {/* View Switcher: Personal vs Direct Reports (if authorized supervisor) */}
        {progressData?.canRateOthers && (
          <div className="progress-mode-toggle">
            <button
              type="button"
              className={`progress-toggle-btn ${viewMode === 'personal' && !selectedReportId ? 'active' : ''}`}
              onClick={() => {
                setViewMode('personal');
                setSelectedReportId(null);
                setReportProgressData(null);
              }}
            >
              My Personal Progress
            </button>
            <button
              type="button"
              className={`progress-toggle-btn ${viewMode === 'reports' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('reports');
              }}
            >
              <UsersIcon size={14} />
              <span>Direct Reports ({directReports.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* DIRECT REPORTS MANAGEMENT VIEW */}
      {viewMode === 'reports' && !selectedReportId && (
        <div className="progress-reports-section animate-fade-in">
          <div className="progress-reports-header">
            <div>
              <div className="progress-submode-pills" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${reportSubMode === 'subordinates' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setReportSubMode('subordinates')}
                >
                  <UsersIcon size={14} />
                  <span>Direct Reports ({directReports.length})</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${reportSubMode === 'recognition_board' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setReportSubMode('recognition_board');
                    loadNominees(nomineePeriodType);
                  }}
                >
                  <AwardIcon size={14} />
                  <span>🏆 Employee of the Month / Year Board</span>
                </button>
              </div>
              <h3 className="progress-section-heading">
                {reportSubMode === 'recognition_board'
                  ? 'Employee Recognition & Honors Board'
                  : 'Supervisory Direct Reports & Evaluations'}
              </h3>
              <p className="progress-section-sub">
                {reportSubMode === 'recognition_board'
                  ? 'Calculate Employee of the Month / Year using multi-metric performance criteria (Ratings 40%, Quality 25%, Delivery 20%, Initiative 15%) and issue official certificates.'
                  : 'Evaluate direct subordinates, inspect performance analytics, and resolve employee review disputes.'}
              </p>
            </div>
            {reportSubMode === 'subordinates' && (
              <div className="progress-search-box">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Search direct reports..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          {reportSubMode === 'subordinates' ? (
            <div className="progress-reports-table-card">
            <table className="progress-reports-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation / Dept</th>
                  <th>Hierarchy Tier</th>
                  <th>Latest Rating</th>
                  <th>Dispute Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirectReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No direct reports found.
                    </td>
                  </tr>
                ) : (
                  filteredDirectReports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="progress-emp-cell">
                          <div className="progress-emp-avatar">{r.name.charAt(0)}</div>
                          <div>
                            <div className="progress-emp-name">{r.name}</div>
                            <div className="progress-emp-email">{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="progress-dept-badge">{r.department}</div>
                        <small style={{ color: '#64748b' }}>{r.designation}</small>
                      </td>
                      <td>
                        <span className={`progress-tier-tag tier-l${r.hierarchyLevel}`}>
                          Level {r.hierarchyLevel}
                        </span>
                      </td>
                      <td>
                        {r.latestScore ? (
                          <div className="progress-score-pill">
                            <StarIcon size={13} filled />
                            <span>{r.latestScore.toFixed(1)} / 5.0</span>
                            <small>({r.latestPeriod})</small>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Unrated</span>
                        )}
                      </td>
                      <td>
                        {r.hasDispute ? (
                          <span className="progress-dispute-alert">Review Requested</span>
                        ) : (
                          <span style={{ color: '#10b981', fontSize: '13px' }}>Normal</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="progress-row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => loadReportProgress(r.id)}
                          >
                            View Telemetry
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setTargetEmployeeForRate(r);
                              setRateForm((prev) => ({ ...prev, period: '' }));
                              setIsRateModalOpen(true);
                            }}
                          >
                            <StarIcon size={14} />
                            <span>Rate Employee</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="progress-recognition-board animate-fade-in">
              <div className="recognition-period-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${nomineePeriodType === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setNomineePeriodType('month');
                      loadNominees('month');
                    }}
                  >
                    Employee of the Month
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${nomineePeriodType === 'year' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setNomineePeriodType('year');
                      loadNominees('year');
                    }}
                  >
                    Employee of the Year
                  </button>
                </div>
                <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6', padding: '6px 12px', borderRadius: '6px', fontWeight: 600 }}>
                  Active Period: {nomineesData?.period || 'Current Cycle'}
                </span>
              </div>

              {/* Existing Approved Award Banner */}
              {nomineesData?.existingAward && (
                <div className="existing-award-card mb-3" style={{ background: 'linear-gradient(135deg, #fef3c7, #fffbeb)', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ fontSize: '32px' }}>🏆</div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, background: '#d97706', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        Officially Conferred
                      </span>
                      <h4 style={{ margin: '4px 0 2px 0', fontSize: '18px', color: '#92400e', fontWeight: 800 }}>
                        {nomineesData.existingAward.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#78350f' }}>
                        Conferred to <strong>{nomineesData.existingAward.employeeName}</strong> ({nomineesData.existingAward.employeeDesignation})
                      </p>
                      <small style={{ fontStyle: 'italic', color: '#b45309' }}>
                        “{nomineesData.existingAward.customComment}”
                      </small>
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setCertModalData({
                          employeeName: nomineesData.existingAward.employeeName,
                          employeeId: nomineesData.existingAward.employeeIdNumber,
                          employeePhoto: nomineesData.existingAward.employeePhoto,
                          title: nomineesData.existingAward.title,
                          period: nomineesData.existingAward.period,
                          customComment: nomineesData.existingAward.customComment,
                          companyName: nomineesData.existingAward.companyName,
                        });
                        setIsCertModalOpen(true);
                      }}
                    >
                      <AwardIcon size={14} />
                      <span>Download Official Certificate</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Nominees Ranked Leaderboard */}
              <div className="progress-reports-table-card">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Multi-Metric Recognition Leaderboard</strong>
                    <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                      (Weighted by Ratings 40%, Quality 25%, Delivery 20%, Initiative 15%)
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                    Independent of raw task volume
                  </span>
                </div>
                <table className="progress-reports-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Rank</th>
                      <th>Candidate</th>
                      <th>Dept & Level</th>
                      <th>Composite Score</th>
                      <th>Criteria Breakdown</th>
                      <th style={{ textAlign: 'right' }}>Official Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!nomineesData?.nominees || nomineesData.nominees.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          No candidates found. Evaluating telemetry...
                        </td>
                      </tr>
                    ) : (
                      nomineesData.nominees.map((nom, idx) => (
                        <tr key={nom.id} style={idx === 0 ? { background: '#fcfbf7' } : {}}>
                          <td>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              fontWeight: 800,
                              fontSize: '12px',
                              background: idx === 0 ? '#fef3c7' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#ffedd5' : '#f1f5f9',
                              color: idx === 0 ? '#b45309' : idx === 1 ? '#475569' : idx === 2 ? '#c2410c' : '#64748b',
                              border: idx === 0 ? '1px solid #fde68a' : 'none'
                            }}>
                              #{idx + 1}
                            </div>
                          </td>
                          <td>
                            <div className="progress-emp-cell">
                              <div className="progress-emp-avatar">{nom.name.charAt(0)}</div>
                              <div>
                                <div className="progress-emp-name">
                                  {nom.name}
                                  {idx === 0 && (
                                    <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 800, background: '#d97706', color: '#ffffff', padding: '1px 6px', borderRadius: '10px' }}>
                                      ★ #1 Ranked
                                    </span>
                                  )}
                                </div>
                                <div className="progress-emp-email">{nom.employeeIdNumber}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="progress-dept-badge">{nom.department}</div>
                            <small style={{ color: '#64748b', display: 'block' }}>Level {nom.hierarchyLevel}</small>
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px', background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                              <strong style={{ color: '#047857', fontSize: '14px' }}>{nom.metrics.compositeScore}%</strong>
                              <small style={{ color: '#065f46', fontSize: '10px' }}>Match</small>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '11px' }}>
                              <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>Rating: {nom.metrics.ratingScore}/5</span>
                              <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>Quality: {nom.metrics.qualityScore}/5</span>
                              <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>Delivery: {nom.metrics.onTimeRate}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setCertModalData({
                                  employeeId: nom.id,
                                  employeeName: nom.name,
                                  employeeIdNumber: nom.employeeIdNumber,
                                  title: nomineePeriodType === 'year'
                                    ? `Employee of the Year – ${nomineesData?.period}`
                                    : `Employee of the Month – ${nomineesData?.period}`,
                                  type: nomineePeriodType,
                                  period: nomineesData?.period,
                                  customComment: `Awarded for distinguished technical leadership, achieving a ${nom.metrics.compositeScore}% composite score with ${nom.metrics.onTimeRate}% on-time delivery across core deliverables.`,
                                  companyName: user.companyName,
                                });
                                setIsCertModalOpen(true);
                              }}
                            >
                              <AwardIcon size={14} />
                              <span>Review & Issue Certificate</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BACK BUTTON WHEN VIEWING A DIRECT REPORT'S PROGRESS */}
      {viewMode === 'reports' && selectedReportId && (
        <div className="progress-back-bar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelectedReportId(null);
              setReportProgressData(null);
            }}
          >
            ← Back to Direct Reports List
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const currentEmp = directReports.find((r) => r.id === selectedReportId) || emp;
              setTargetEmployeeForRate(currentEmp);
              setIsRateModalOpen(true);
            }}
          >
            <StarIcon size={14} />
            <span>Submit New Rating for {emp.name}</span>
          </button>
        </div>
      )}

      {/* TOP METRICS ROW (Visible for Personal or Selected Report) */}
      {(viewMode === 'personal' || selectedReportId) && (
        <>
          <div className="progress-metrics-grid">
            {/* Metric 1: Overall Performance Score */}
            <div className="progress-metric-card highlight-card">
              <div className="metric-header">
                <span className="metric-title">Aggregated Rating</span>
                <span className={`progress-band-pill band-${aggregate.performanceBand?.toLowerCase().replace(/\s+/g, '-')}`}>
                  {aggregate.performanceBand || 'Not Rated'}
                </span>
              </div>
              <div className="metric-body">
                <div className="metric-big-score">
                  <span className="score-number">
                    {aggregate.hasRatings ? aggregate.aggregateScore.toFixed(2) : '--'}
                  </span>
                  <span className="score-denom">/ 5.0</span>
                </div>
                <div className="metric-stars-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      size={18}
                      filled={star <= Math.round(aggregate.aggregateScore || 0)}
                      className="metric-star-icon"
                    />
                  ))}
                  <span className="metric-score-pct">
                    {aggregate.hasRatings ? `${aggregate.percentage}% Overall Score` : 'No reviews'}
                  </span>
                </div>
              </div>
              <div className="metric-footer">
                <span>Calculated across {aggregate.totalReviewsCount || 0} reviews</span>
                <ShieldIcon size={14} />
              </div>
            </div>

            {/* Metric 2: Assigned & Approved Projects */}
            <div className="progress-metric-card">
              <div className="metric-header">
                <span className="metric-title">Projects Telemetry</span>
                <CheckCircleIcon size={18} className="text-emerald" />
              </div>
              <div className="metric-body">
                <div className="metric-stats-split">
                  <div>
                    <div className="split-number">{assignedProjects.length}</div>
                    <div className="split-label">Assigned Projects</div>
                  </div>
                  <div className="split-divider" />
                  <div>
                    <div className="split-number text-emerald">{approvedProjects.length}</div>
                    <div className="split-label">Approved & Completed</div>
                  </div>
                </div>
              </div>
              <div className="metric-footer">
                <span>
                  {assignedProjects.length > 0
                    ? `${Math.round((approvedProjects.length / assignedProjects.length) * 100)}% Project Approval Rate`
                    : 'No active projects'}
                </span>
              </div>
            </div>

            {/* Metric 3: Milestone Delivery Stats */}
            <div className="progress-metric-card">
              <div className="metric-header">
                <span className="metric-title">Milestone Completion</span>
                <ClockIcon size={18} className="text-blue" />
              </div>
              <div className="metric-body">
                <div className="metric-stats-split">
                  <div>
                    <div className="split-number text-blue">{stats.completed}</div>
                    <div className="split-label">Completed ({stats.total} Total)</div>
                  </div>
                  <div className="split-divider" />
                  <div>
                    <div className="split-number text-purple">{stats.onTimeRate}%</div>
                    <div className="split-label">On-Time Delivery</div>
                  </div>
                </div>
              </div>
              <div className="metric-footer">
                <span className={stats.overdue > 0 ? 'text-amber' : 'text-emerald'}>
                  {stats.overdue > 0 ? `${stats.overdue} Milestone(s) Overdue` : 'Zero Overdue Milestones'}
                </span>
              </div>
            </div>
          </div>

          {/* SUB-TABS NAVIGATION */}
          <div className="progress-subtabs-nav">
            <button
              type="button"
              className={`progress-subtab-btn ${activeSubTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('analytics')}
            >
              <TrendingUpIcon size={16} />
              <span>Performance Analytics & Trends</span>
            </button>
            <button
              type="button"
              className={`progress-subtab-btn ${activeSubTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('projects')}
            >
              <CheckSquareIcon size={16} />
              <span>Assigned & Approved Projects ({assignedProjects.length})</span>
            </button>
            <button
              type="button"
              className={`progress-subtab-btn ${activeSubTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('reviews')}
            >
              <AwardIcon size={16} />
              <span>Ratings & Audit History ({ratings.length})</span>
            </button>
            <button
              type="button"
              className={`progress-subtab-btn ${activeSubTab === 'self_eval' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('self_eval')}
            >
              <SparklesIcon size={16} />
              <span>Self-Evaluation ({selfEvaluations.length})</span>
            </button>
            <button
              type="button"
              className={`progress-subtab-btn ${activeSubTab === 'recognition' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('recognition')}
            >
              <AwardIcon size={16} />
              <span>Honors & Certificates ({awards.filter(a => String(a.employeeId) === String(emp.id || emp._id)).length})</span>
            </button>
          </div>

          {/* SUB-TAB 1: PERFORMANCE ANALYTICS & TRENDS */}
          {activeSubTab === 'analytics' && (
            <div className="progress-tab-pane animate-fade-in">
              <div className="progress-analytics-grid">
                {/* Competency Breakdown Meters */}
                <div className="analytics-card">
                  <div className="card-header-row">
                    <h4 className="card-title">Competency Evaluation Breakdown</h4>
                    <span className="card-subtitle">Scale 1.0 - 5.0</span>
                  </div>
                  <div className="competency-meters-list">
                    {[
                      {
                        key: 'qualityOfWork',
                        label: 'Quality of Work & Deliverables',
                        score: aggregate.categoryAverages?.qualityOfWork || 0,
                      },
                      {
                        key: 'timeliness',
                        label: 'Timeliness & Schedule Adherence',
                        score: aggregate.categoryAverages?.timeliness || 0,
                      },
                      {
                        key: 'initiative',
                        label: 'Initiative & Problem Solving',
                        score: aggregate.categoryAverages?.initiative || 0,
                      },
                      {
                        key: 'collaboration',
                        label: 'Collaboration & Teamwork',
                        score: aggregate.categoryAverages?.collaboration || 0,
                      },
                    ].map((comp) => {
                      const pct = Math.min(100, Math.max(0, (comp.score / 5) * 100));
                      return (
                        <div key={comp.key} className="competency-item">
                          <div className="comp-meta">
                            <span className="comp-label">{comp.label}</span>
                            <span className="comp-score">
                              {comp.score > 0 ? `${comp.score.toFixed(1)} / 5.0` : 'Unrated'}
                            </span>
                          </div>
                          <div className="comp-meter-track">
                            <div className="comp-meter-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Evaluator Tier Breakdown */}
                  <div className="tier-breakdown-section">
                    <h5 className="tier-title">Hierarchy Evaluator Breakdown (L1, L2, L3)</h5>
                    <div className="tier-badges-row">
                      {['L1', 'L2', 'L3'].map((tier) => {
                        const tierInfo = aggregate.tierBreakdown?.[tier];
                        const tierLabels = {
                          L1: 'Executive / Leadership',
                          L2: 'Director / Dept Head',
                          L3: 'Manager / Team Lead',
                        };
                        return (
                          <div key={tier} className={`tier-card ${tierInfo ? 'active' : 'empty'}`}>
                            <div className="tier-header">
                              <span className={`tier-pill tier-${tier.toLowerCase()}`}>{tier}</span>
                              <span className="tier-name">{tierLabels[tier]}</span>
                            </div>
                            <div className="tier-score">
                              {tierInfo ? `${tierInfo.average.toFixed(2)} / 5.0` : 'Not Rated Yet'}
                            </div>
                            <small className="tier-footer">
                              {tierInfo ? `${tierInfo.count} review(s) (Weight ${(tierInfo.weight * 100).toFixed(0)}%)` : 'No reviews'}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Rating Trends Chart & Insights */}
                <div className="analytics-card">
                  <div className="card-header-row">
                    <h4 className="card-title">Rating Trajectory & Trends</h4>
                    <span className="card-subtitle">Performance progression over time</span>
                  </div>

                  {trends.length === 0 ? (
                    <div className="trends-empty-state">
                      <ClockIcon size={32} />
                      <p>No historical rating periods recorded yet.</p>
                    </div>
                  ) : (
                    <div className="trends-chart-container">
                      <div className="trends-chart-bars">
                        {trends.map((t, idx) => {
                          const heightPct = Math.max(15, (t.score / 5) * 100);
                          return (
                            <div key={t.id || idx} className="trend-bar-col">
                              <div className="trend-bar-value">{t.score.toFixed(1)}</div>
                              <div className="trend-bar-slot">
                                <div
                                  className="trend-bar-fill"
                                  style={{ height: `${heightPct}%` }}
                                  title={`${t.period}: ${t.score} by ${t.evaluatorName} (${t.tier})`}
                                />
                              </div>
                              <div className="trend-bar-period">{t.period}</div>
                              <span className={`trend-bar-tier tier-${t.tier?.toLowerCase()}`}>{t.tier}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Highlights: Achievements & Pending Areas */}
                  <div className="insights-boxes-row">
                    <div className="insight-box strengths-box">
                      <div className="insight-title">
                        <AwardIcon size={16} />
                        <span>Achievements & Key Strengths</span>
                      </div>
                      <div className="insight-tags">
                        {aggregate.strengths?.length > 0 ? (
                          aggregate.strengths.map((str, idx) => (
                            <span key={idx} className="insight-tag strength-tag">
                              ✓ {str}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">No specific strengths tagged yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="insight-box growth-box">
                      <div className="insight-title">
                        <TrendingUpIcon size={16} />
                        <span>Growth & Pending Areas</span>
                      </div>
                      <div className="insight-tags">
                        {aggregate.areasForImprovement?.length > 0 ? (
                          aggregate.areasForImprovement.map((area, idx) => (
                            <span key={idx} className="insight-tag growth-tag">
                              • {area}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">No pending growth areas noted.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: ASSIGNED & APPROVED PROJECTS */}
          {activeSubTab === 'projects' && (
            <div className="progress-tab-pane animate-fade-in">
              <div className="projects-grid-list">
                {assignedProjects.length === 0 ? (
                  <div className="projects-empty-card">
                    <CheckSquareIcon size={36} />
                    <h4>No Assigned Projects Yet</h4>
                    <p>Projects and milestones assigned to you will automatically show up here with live progress tracking.</p>
                  </div>
                ) : (
                  assignedProjects.map((proj) => {
                    const isApproved = approvedProjects.some((p) => String(p._id) === String(proj._id));
                    const totalMilestones = (proj.milestones || []).length;
                    const completedMilestones = (proj.milestones || []).filter((m) => m.completed).length;
                    const pct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

                    return (
                      <div key={proj._id} className="progress-project-card">
                        <div className="proj-card-top">
                          <div>
                            <div className="proj-dept-badge">{proj.department || 'General'}</div>
                            <h3 className="proj-card-name">{proj.name}</h3>
                          </div>
                          <span className={`proj-status-pill ${isApproved ? 'status-approved' : 'status-active'}`}>
                            {isApproved ? 'Approved & Completed' : 'In Progress'}
                          </span>
                        </div>

                        {proj.description && <p className="proj-card-desc">{proj.description}</p>}

                        {/* Project Dates */}
                        <div className="proj-dates-row">
                          <div className="proj-date-item">
                            <CalendarIcon size={14} />
                            <span>Start: {proj.startDate ? new Date(proj.startDate).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          <div className="proj-date-item">
                            <ClockIcon size={14} />
                            <span>Target: {proj.targetCompletionDate || proj.deadline ? new Date(proj.targetCompletionDate || proj.deadline).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="proj-progress-wrap">
                          <div className="proj-progress-meta">
                            <span>Project Completion</span>
                            <span>{pct}% ({completedMilestones}/{totalMilestones} Milestones)</span>
                          </div>
                          <div className="proj-progress-track">
                            <div className="proj-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        {/* Milestones List Underneath Project */}
                        <div className="proj-milestones-accordion">
                          <h4 className="milestones-heading">Milestones & Progress Notes:</h4>
                          <div className="milestones-sublist">
                            {(proj.milestones || []).map((m) => {
                              const isEmpAssigned = (m.assignedTo || []).some(
                                (a) => String(a.userId) === String(emp.id || emp._id) || String(a._id) === String(emp.id || emp._id)
                              );
                              return (
                                <div key={m.id || m._id} className={`proj-milestone-row ${m.completed ? 'completed' : ''}`}>
                                  <div className="m-left">
                                    <div className="m-status-icon">
                                      {m.completed ? <CheckCircleIcon size={16} /> : <ClockIcon size={16} />}
                                    </div>
                                    <div>
                                      <div className="m-title">
                                        {m.title}
                                        {isEmpAssigned && <span className="m-my-pill">My Milestone</span>}
                                      </div>
                                      {m.description && <div className="m-desc">{m.description}</div>}
                                      {m.deadline && (
                                        <div className="m-due">Deadline: {new Date(m.deadline).toLocaleDateString()}</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="m-right">
                                    {/* Progress notes count & trigger */}
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => {
                                        setActiveMilestoneForNote({
                                          projectId: proj._id,
                                          ...m,
                                        });
                                        setIsNoteModalOpen(true);
                                      }}
                                    >
                                      <MessageSquareIcon size={13} />
                                      <span>Notes ({(m.progressNotes || []).length})</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: RATINGS & AUDIT HISTORY */}
          {activeSubTab === 'reviews' && (
            <div className="progress-tab-pane animate-fade-in">
              <div className="ratings-list-header">
                <div>
                  <h3 className="section-title">Superior Performance Ratings</h3>
                  <p className="section-subtitle">
                    Ratings conducted by authorized leadership, department heads, and managers with full audit trails.
                  </p>
                </div>
              </div>

              {ratings.length === 0 ? (
                <div className="ratings-empty-card">
                  <StarIcon size={36} />
                  <h4>No Performance Ratings Published Yet</h4>
                  <p>When your designated superiors evaluate your deliverables, their evaluations and feedback will be securely calculated and presented here.</p>
                </div>
              ) : (
                <div className="ratings-cards-list">
                  {ratings.map((r) => (
                    <div key={r._id} className="rating-card">
                      <div className="rating-card-top">
                        <div className="rating-evaluator-meta">
                          <div className="eval-avatar">{r.evaluatorName.charAt(0)}</div>
                          <div>
                            <div className="eval-name">
                              {r.evaluatorName}
                              <span className={`eval-tier-tag tier-${r.evaluatorTier?.toLowerCase()}`}>
                                {r.evaluatorTier} Review
                              </span>
                            </div>
                            <div className="eval-role">{r.evaluatorRole?.toUpperCase()} • {r.period}</div>
                          </div>
                        </div>

                        <div className="rating-score-badge">
                          <span className="badge-score">{r.scores.overallScore.toFixed(2)}</span>
                          <span className="badge-denom">/ 5.0</span>
                        </div>
                      </div>

                      {/* Scores Breakdown */}
                      <div className="rating-scores-grid">
                        <div className="score-mini-col">
                          <span className="col-label">Quality</span>
                          <span className="col-val">{r.scores.qualityOfWork} / 5</span>
                        </div>
                        <div className="score-mini-col">
                          <span className="col-label">Timeliness</span>
                          <span className="col-val">{r.scores.timeliness} / 5</span>
                        </div>
                        <div className="score-mini-col">
                          <span className="col-label">Initiative</span>
                          <span className="col-val">{r.scores.initiative} / 5</span>
                        </div>
                        <div className="score-mini-col">
                          <span className="col-label">Collaboration</span>
                          <span className="col-val">{r.scores.collaboration} / 5</span>
                        </div>
                      </div>

                      {/* Narrative Feedback */}
                      {r.comments && (
                        <div className="rating-comments-box">
                          <strong>Evaluator Feedback:</strong>
                          <p>{r.comments}</p>
                        </div>
                      )}

                      {/* Strengths & Improvement Areas */}
                      {(r.strengths?.length > 0 || r.areasForImprovement?.length > 0) && (
                        <div className="rating-tags-row">
                          {r.strengths?.map((s, idx) => (
                            <span key={idx} className="tag-strength">✓ {s}</span>
                          ))}
                          {r.areasForImprovement?.map((a, idx) => (
                            <span key={idx} className="tag-growth">• {a}</span>
                          ))}
                        </div>
                      )}

                      {/* Dispute Status Banner if disputed */}
                      {r.dispute?.isDisputed && (
                        <div className="rating-dispute-banner">
                          <AlertTriangleIcon size={16} />
                          <div>
                            <strong>Dispute / Review Request:</strong>
                            <p>{r.dispute.reason}</p>
                            {r.dispute.resolutionStatus !== 'none' && (
                              <small>Status: {r.dispute.resolutionStatus.toUpperCase()} - {r.dispute.resolutionNotes || 'Under investigation'}</small>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rating Card Footer Actions */}
                      <div className="rating-card-footer">
                        <div className="rating-date">
                          Submitted on {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                        <div className="rating-footer-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setActiveRatingForAction(r);
                              setIsAuditModalOpen(true);
                            }}
                          >
                            <ShieldIcon size={13} />
                            <span>Audit History</span>
                          </button>

                          {/* Dispute Button (For evaluated employee) */}
                          {String(emp.id || emp._id) === String(user._id) && !r.dispute?.isDisputed && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setActiveRatingForAction(r);
                                setIsDisputeModalOpen(true);
                              }}
                            >
                              <AlertTriangleIcon size={13} />
                              <span>Dispute / Request Review</span>
                            </button>
                          )}

                          {/* Resolve Dispute Button (For superior evaluator or admin) */}
                          {r.dispute?.isDisputed && r.status === 'disputed' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setActiveRatingForAction(r);
                                setResolveForm({
                                  resolutionStatus: 'reviewed',
                                  resolutionNotes: '',
                                  adjustScores: false,
                                  qualityOfWork: r.scores.qualityOfWork,
                                  timeliness: r.scores.timeliness,
                                  initiative: r.scores.initiative,
                                  collaboration: r.scores.collaboration,
                                });
                                setIsResolveModalOpen(true);
                              }}
                            >
                              <span>Resolve Dispute</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 4: SELF-EVALUATION */}
          {activeSubTab === 'self_eval' && (
            <div className="progress-tab-pane animate-fade-in">
              <div className="self-eval-header-card">
                <div>
                  <h3 className="section-title">Employee Self-Evaluation</h3>
                  <p className="section-subtitle">
                    Assess your accomplishments, delivery quality, problem solving, and professional development.
                  </p>
                </div>
                {String(emp.id || emp._id) === String(user._id) && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSelfEvalForm({
                        period: '',
                        qualityOfWork: 4,
                        timeliness: 4,
                        initiative: 4,
                        collaboration: 4,
                        strengthsText: '',
                        areasText: '',
                        comments: '',
                      });
                      setIsSelfEvalModalOpen(true);
                    }}
                  >
                    <PlusIcon size={16} />
                    <span>Submit Self-Evaluation</span>
                  </button>
                )}
              </div>

              {selfEvaluations.length === 0 ? (
                <div className="ratings-empty-card">
                  <SparklesIcon size={36} />
                  <h4>No Self-Evaluations Submitted</h4>
                  <p>Submit your own self-reflection to document your deliverables and compare perspectives alongside superior evaluations.</p>
                </div>
              ) : (
                <div className="ratings-cards-list">
                  {selfEvaluations.map((se) => (
                    <div key={se._id} className="rating-card self-card">
                      <div className="rating-card-top">
                        <div className="rating-evaluator-meta">
                          <div className="eval-avatar self">★</div>
                          <div>
                            <div className="eval-name">
                              {se.employeeName}
                              <span className="eval-tier-tag tier-self">Self-Evaluation</span>
                            </div>
                            <div className="eval-role">{se.period}</div>
                          </div>
                        </div>
                        <div className="rating-score-badge self">
                          <span className="badge-score">{se.scores.overallScore.toFixed(2)}</span>
                          <span className="badge-denom">/ 5.0</span>
                        </div>
                      </div>

                      <div className="rating-scores-grid">
                        <div className="score-mini-col">
                          <span className="col-label">Quality</span>
                          <span className="col-val">{se.scores.qualityOfWork} / 5</span>
                        </div>
                        <div className="score-mini-col">
                          <span className="col-label">Timeliness</span>
                          <span className="col-val">{se.scores.timeliness} / 5</span>
                        </div>
                        <div className="score-mini-col">
                          <span className="col-label">Initiative</span>
                          <span className="col-val">{se.scores.initiative} / 5</span>
                        </div>
                        <div className="score-mini-col">
                          <span className="col-label">Collaboration</span>
                          <span className="col-val">{se.scores.collaboration} / 5</span>
                        </div>
                      </div>

                      {se.comments && (
                        <div className="rating-comments-box">
                          <strong>Self-Reflection & Notes:</strong>
                          <p>{se.comments}</p>
                        </div>
                      )}

                      {(se.strengths?.length > 0 || se.areasForImprovement?.length > 0) && (
                        <div className="rating-tags-row">
                          {se.strengths?.map((s, idx) => (
                            <span key={idx} className="tag-strength">✓ {s}</span>
                          ))}
                          {se.areasForImprovement?.map((a, idx) => (
                            <span key={idx} className="tag-growth">• {a}</span>
                          ))}
                        </div>
                      )}

                      <div className="rating-card-footer">
                        <div className="rating-date">
                          Submitted on {new Date(se.createdAt).toLocaleDateString()}
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveRatingForAction(se);
                            setIsAuditModalOpen(true);
                          }}
                        >
                          <ShieldIcon size={13} />
                          <span>Audit Record</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 5: HONORS & OFFICIAL CERTIFICATES */}
          {activeSubTab === 'recognition' && (
            <div className="progress-tab-pane animate-fade-in">
              <div className="self-eval-header-card">
                <div>
                  <h3 className="section-title">Official Recognition & Certificates</h3>
                  <p className="section-subtitle">
                    Download official high-resolution certificates in PDF and PNG/JPEG format with executive seals and verification codes.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setCertModalData({
                      employeeName: emp.name,
                      employeeId: emp.employeeIdNumber || emp.employeeId || 'EMP-100',
                      employeePhoto: '',
                      title: 'Certificate of Excellence',
                      period: new Date().getFullYear().toString(),
                      customComment: 'Awarded for outstanding technical contribution, dedication to quality, and excellence in deliverable execution.',
                      companyName: user.companyName,
                    });
                    setIsCertModalOpen(true);
                  }}
                >
                  <AwardIcon size={16} />
                  <span>Generate Certificate</span>
                </button>
              </div>

              {awards.filter((a) => String(a.employeeId) === String(emp.id || emp._id)).length === 0 ? (
                <div className="ratings-empty-card">
                  <AwardIcon size={36} />
                  <h4>No Official Honors Conferred Yet</h4>
                  <p>When leadership officially confers an &quot;Employee of the Month&quot; or &quot;Employee of the Year&quot; award to you, your official certificate will appear here ready to download in PDF and PNG format.</p>
                </div>
              ) : (
                <div className="ratings-cards-list">
                  {awards
                    .filter((a) => String(a.employeeId) === String(emp.id || emp._id))
                    .map((award) => (
                      <div key={award._id} className="rating-card" style={{ background: 'linear-gradient(135deg, #fffdfa, #fefbf3)', borderColor: '#fde68a' }}>
                        <div className="rating-card-top">
                          <div className="rating-evaluator-meta">
                            <div className="eval-avatar" style={{ background: '#d97706', fontSize: '20px' }}>🏆</div>
                            <div>
                              <div className="eval-name" style={{ color: '#92400e' }}>
                                {award.title}
                                <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                                  {award.type === 'year' ? 'Annual Award' : 'Monthly Award'}
                                </span>
                              </div>
                              <div className="eval-role" style={{ color: '#b45309' }}>
                                Conferred for {award.period} by {award.approvedByName}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '6px 14px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                            <CheckCircleIcon size={16} className="text-emerald" />
                            <strong style={{ color: '#047857' }}>Official Award</strong>
                          </div>
                        </div>

                        {award.customComment && (
                          <div className="rating-comments-box" style={{ background: '#fef3c7', borderLeftColor: '#d97706' }}>
                            <strong style={{ color: '#92400e' }}>Official Citation:</strong>
                            <p style={{ fontStyle: 'italic', color: '#78350f' }}>“{award.customComment}”</p>
                          </div>
                        )}

                        <div className="rating-card-footer" style={{ borderTopColor: '#fde68a' }}>
                          <div className="rating-date">
                            Conferred on {new Date(award.approvedAt || award.createdAt).toLocaleDateString()}
                          </div>
                          <div className="rating-footer-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setCertModalData({
                                  employeeName: award.employeeName,
                                  employeeId: award.employeeIdNumber,
                                  employeePhoto: award.employeePhoto,
                                  title: award.title,
                                  period: award.period,
                                  customComment: award.customComment,
                                  companyName: award.companyName,
                                });
                                setIsCertModalOpen(true);
                              }}
                            >
                              <AwardIcon size={13} />
                              <span>View & Download Certificate (PDF / PNG)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: RATE EMPLOYEE (SUPERIOR/ADMIN ONLY) */}
      {/* ======================================================== */}
      {isRateModalOpen && targetEmployeeForRate && (
        <div className="wa-assign-modal-overlay" onClick={() => setIsRateModalOpen(false)}>
          <div className="wa-assign-modal-box animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="wa-assign-modal-header">
              <div>
                <h3 className="wa-assign-title">
                  Evaluate & Rate {targetEmployeeForRate.name}
                </h3>
                <p className="wa-assign-subtitle">
                  {targetEmployeeForRate.designation} • {targetEmployeeForRate.department} • Tier Level {targetEmployeeForRate.hierarchyLevel}
                </p>
              </div>
              <button
                type="button"
                className="wa-assign-close-btn"
                onClick={() => setIsRateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRateSubmit}>
              <div className="wa-assign-modal-body">
                <div className="form-group mb-3">
                  <label>Evaluation Period (Quarter / Cycle)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Q1 2026, Annual 2026, Milestone Review"
                    value={rateForm.period}
                    onChange={(e) => setRateForm({ ...rateForm, period: e.target.value })}
                  />
                </div>

                <div className="rating-sliders-container mb-3">
                  {[
                    { key: 'qualityOfWork', label: 'Quality of Work & Deliverables' },
                    { key: 'timeliness', label: 'Timeliness & Schedule Adherence' },
                    { key: 'initiative', label: 'Initiative & Problem Solving' },
                    { key: 'collaboration', label: 'Communication & Collaboration' },
                  ].map((field) => (
                    <div key={field.key} className="rating-slider-row">
                      <div className="slider-label-row">
                        <span>{field.label}</span>
                        <strong className="slider-val">{rateForm[field.key]} / 5</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={rateForm[field.key]}
                        onChange={(e) => setRateForm({ ...rateForm, [field.key]: e.target.value })}
                        className="progress-range-slider"
                      />
                    </div>
                  ))}
                </div>

                <div className="form-group mb-3">
                  <label>Key Strengths & Achievements (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. High attention to detail, Proactive delivery, Strong architecture"
                    value={rateForm.strengthsText}
                    onChange={(e) => setRateForm({ ...rateForm, strengthsText: e.target.value })}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Areas for Growth & Pending Items (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Unit test coverage, Documentation updates"
                    value={rateForm.areasText}
                    onChange={(e) => setRateForm({ ...rateForm, areasText: e.target.value })}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Detailed Feedback & Narrative Comments</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Provide constructive feedback, deliverable observations, and expectations for the upcoming cycle..."
                    value={rateForm.comments}
                    onChange={(e) => setRateForm({ ...rateForm, comments: e.target.value })}
                  />
                </div>
              </div>

              <div className="wa-assign-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Performance Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: SELF-EVALUATION */}
      {/* ======================================================== */}
      {isSelfEvalModalOpen && (
        <div className="wa-assign-modal-overlay" onClick={() => setIsSelfEvalModalOpen(false)}>
          <div className="wa-assign-modal-box animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="wa-assign-modal-header">
              <div>
                <h3 className="wa-assign-title">Submit Self-Evaluation</h3>
                <p className="wa-assign-subtitle">
                  Reflect on your accomplishments and contributions for this cycle.
                </p>
              </div>
              <button
                type="button"
                className="wa-assign-close-btn"
                onClick={() => setIsSelfEvalModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSelfEvalSubmit}>
              <div className="wa-assign-modal-body">
                <div className="form-group mb-3">
                  <label>Evaluation Period</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Q1 2026, Current Milestone"
                    value={selfEvalForm.period}
                    onChange={(e) => setSelfEvalForm({ ...selfEvalForm, period: e.target.value })}
                  />
                </div>

                <div className="rating-sliders-container mb-3">
                  {[
                    { key: 'qualityOfWork', label: 'Quality of My Work' },
                    { key: 'timeliness', label: 'My Timeliness & Delivery' },
                    { key: 'initiative', label: 'My Initiative & Problem Solving' },
                    { key: 'collaboration', label: 'My Collaboration & Team Support' },
                  ].map((field) => (
                    <div key={field.key} className="rating-slider-row">
                      <div className="slider-label-row">
                        <span>{field.label}</span>
                        <strong className="slider-val">{selfEvalForm[field.key]} / 5</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={selfEvalForm[field.key]}
                        onChange={(e) => setSelfEvalForm({ ...selfEvalForm, [field.key]: e.target.value })}
                        className="progress-range-slider"
                      />
                    </div>
                  ))}
                </div>

                <div className="form-group mb-3">
                  <label>Key Accomplishments (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Shipped authentication refactor, Fixed camera WebRTC bugs"
                    value={selfEvalForm.strengthsText}
                    onChange={(e) => setSelfEvalForm({ ...selfEvalForm, strengthsText: e.target.value })}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Areas Where I Want Support / Growth (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Cloud scaling, Project leadership"
                    value={selfEvalForm.areasText}
                    onChange={(e) => setSelfEvalForm({ ...selfEvalForm, areasText: e.target.value })}
                  />
                </div>

                <div className="form-group mb-3">
                  <label>Personal Reflection & Goals</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Reflect on your personal milestones and objectives..."
                    value={selfEvalForm.comments}
                    onChange={(e) => setSelfEvalForm({ ...selfEvalForm, comments: e.target.value })}
                  />
                </div>
              </div>

              <div className="wa-assign-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSelfEvalModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Self-Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: DISPUTE / REQUEST REVIEW */}
      {/* ======================================================== */}
      {isDisputeModalOpen && activeRatingForAction && (
        <div className="wa-assign-modal-overlay" onClick={() => setIsDisputeModalOpen(false)}>
          <div className="wa-assign-modal-box animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="wa-assign-modal-header">
              <div>
                <h3 className="wa-assign-title">Request Review on Rating</h3>
                <p className="wa-assign-subtitle">
                  {activeRatingForAction.period} evaluation by {activeRatingForAction.evaluatorName}
                </p>
              </div>
              <button
                type="button"
                className="wa-assign-close-btn"
                onClick={() => setIsDisputeModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDisputeSubmit}>
              <div className="wa-assign-modal-body">
                <div className="form-group mb-3">
                  <label>Primary Reason for Review Request *</label>
                  <select
                    className="form-control"
                    value={disputeForm.reason}
                    onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                    required
                  >
                    <option value="Score discrepancy based on delivered deliverables">
                      Score discrepancy based on delivered deliverables
                    </option>
                    <option value="Unrecorded milestones completed before deadline">
                      Unrecorded milestones completed before deadline
                    </option>
                    <option value="Disagreement with narrative feedback or scope">
                      Disagreement with narrative feedback or scope
                    </option>
                    <option value="External dependency blocker out of personal control">
                      External dependency blocker out of personal control
                    </option>
                    <option value="Requesting second-level leadership re-evaluation">
                      Requesting second-level leadership re-evaluation
                    </option>
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label>Detailed Notes & Justification *</label>
                  <textarea
                    rows={4}
                    className="form-control"
                    placeholder="Provide specific milestone references, delivery dates, or clarification for your superior to review..."
                    value={disputeForm.employeeNotes}
                    onChange={(e) => setDisputeForm({ ...disputeForm, employeeNotes: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="wa-assign-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsDisputeModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Review Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: RESOLVE DISPUTE */}
      {/* ======================================================== */}
      {isResolveModalOpen && activeRatingForAction && (
        <div className="wa-assign-modal-overlay" onClick={() => setIsResolveModalOpen(false)}>
          <div className="wa-assign-modal-box animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="wa-assign-modal-header">
              <div>
                <h3 className="wa-assign-title">Resolve Performance Dispute</h3>
                <p className="wa-assign-subtitle">
                  Employee notes: &quot;{activeRatingForAction.dispute?.employeeNotes}&quot;
                </p>
              </div>
              <button
                type="button"
                className="wa-assign-close-btn"
                onClick={() => setIsResolveModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResolveSubmit}>
              <div className="wa-assign-modal-body">
                <div className="form-group mb-3">
                  <label>Resolution Action *</label>
                  <select
                    className="form-control"
                    value={resolveForm.resolutionStatus}
                    onChange={(e) =>
                      setResolveForm({
                        ...resolveForm,
                        resolutionStatus: e.target.value,
                        adjustScores: e.target.value === 'adjusted',
                      })
                    }
                  >
                    <option value="reviewed">Reviewed & Confirmed Existing Rating</option>
                    <option value="adjusted">Adjust Scores & Update Telemetry</option>
                    <option value="upheld">Upheld Original Evaluation</option>
                  </select>
                </div>

                {resolveForm.adjustScores && (
                  <div className="rating-sliders-container mb-3">
                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                      Adjust scores below. The backend will securely recompute overall score and save previous scores in the audit trail.
                    </p>
                    {[
                      { key: 'qualityOfWork', label: 'Quality of Work' },
                      { key: 'timeliness', label: 'Timeliness' },
                      { key: 'initiative', label: 'Initiative' },
                      { key: 'collaboration', label: 'Collaboration' },
                    ].map((field) => (
                      <div key={field.key} className="rating-slider-row">
                        <div className="slider-label-row">
                          <span>{field.label}</span>
                          <strong className="slider-val">{resolveForm[field.key]} / 5</strong>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={resolveForm[field.key]}
                          onChange={(e) => setResolveForm({ ...resolveForm, [field.key]: e.target.value })}
                          className="progress-range-slider"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-group mb-3">
                  <label>Resolution Explanation & Notes *</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Document the resolution rationale, agreements made, and feedback..."
                    value={resolveForm.resolutionNotes}
                    onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="wa-assign-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsResolveModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Dispute Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: MILESTONE PROGRESS NOTE */}
      {/* ======================================================== */}
      {isNoteModalOpen && activeMilestoneForNote && (
        <div className="wa-assign-modal-overlay" onClick={() => setIsNoteModalOpen(false)}>
          <div className="wa-assign-modal-box animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="wa-assign-modal-header">
              <div>
                <h3 className="wa-assign-title">Milestone Progress Notes</h3>
                <p className="wa-assign-subtitle">{activeMilestoneForNote.title}</p>
              </div>
              <button
                type="button"
                className="wa-assign-close-btn"
                onClick={() => setIsNoteModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="wa-assign-modal-body">
              {/* Existing Notes List */}
              <div className="milestone-notes-thread mb-3">
                {(activeMilestoneForNote.progressNotes || []).length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>No progress notes posted yet.</p>
                ) : (
                  (activeMilestoneForNote.progressNotes || []).map((note, idx) => (
                    <div key={note.id || idx} className="milestone-note-bubble">
                      <div className="note-meta">
                        <strong>{note.authorName}</strong>
                        <small>{new Date(note.createdAt).toLocaleString()}</small>
                      </div>
                      <p className="note-text">{note.note}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add New Note */}
              <form onSubmit={handleNoteSubmit}>
                <div className="form-group mb-2">
                  <label>Add Progress Note / Update</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Document milestone progress, blockers, or deliverables completed..."
                    value={noteForm.note}
                    onChange={(e) => setNoteForm({ note: e.target.value })}
                    required
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Post Progress Note
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: AUDIT TRAIL MODAL */}
      {/* ======================================================== */}
      {isAuditModalOpen && activeRatingForAction && (
        <div className="wa-assign-modal-overlay" onClick={() => setIsAuditModalOpen(false)}>
          <div className="wa-assign-modal-box animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="wa-assign-modal-header">
              <div>
                <h3 className="wa-assign-title">Rating Audit Trail</h3>
                <p className="wa-assign-subtitle">
                  Immutable historical event log for {activeRatingForAction.period} rating
                </p>
              </div>
              <button
                type="button"
                className="wa-assign-close-btn"
                onClick={() => setIsAuditModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="wa-assign-modal-body">
              <div className="audit-timeline">
                {(activeRatingForAction.auditTrail || []).length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No audit events logged.</p>
                ) : (
                  (activeRatingForAction.auditTrail || []).map((entry, idx) => (
                    <div key={idx} className="audit-event-item">
                      <div className="audit-event-dot" />
                      <div className="audit-event-content">
                        <div className="audit-event-header">
                          <span className={`audit-action-pill action-${entry.action}`}>
                            {entry.action.toUpperCase()}
                          </span>
                          <span className="audit-time">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="audit-actor">
                          By: <strong>{entry.performedByName}</strong> ({entry.performedByRole})
                        </div>
                        <div className="audit-details">{entry.details}</div>
                        {entry.previousScores && (
                          <div className="audit-prev-scores">
                            Previous Scores: Q:{entry.previousScores.qualityOfWork}, T:{entry.previousScores.timeliness}, I:{entry.previousScores.initiative}, C:{entry.previousScores.collaboration} (Overall: {entry.previousScores.overallScore})
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="wa-assign-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAuditModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: OFFICIAL CERTIFICATE GENERATOR */}
      {/* ======================================================== */}
      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        initialData={certModalData}
        isAdmin={user?.role === 'admin' || user?.hierarchyLevel === 1}
        isHR={user?.role === 'admin' || user?.role === 'hr' || user?.hierarchyLevel === 1 || Boolean(user?.permissions?.canManageEmployees)}
        user={user}
        onAwardApproved={async () => {
          await loadAwards();
          await loadNominees(nomineePeriodType);
          await loadProgressData();
        }}
      />
    </div>
  );
};
