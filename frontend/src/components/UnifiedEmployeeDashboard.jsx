import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  CalendarIcon,
  UserIcon,
  PlusIcon,
  EditIcon,
  SearchIcon,
  FileTextIcon,
  SparklesIcon,
  UsersIcon,
  LockIcon,
  CheckIcon,
  CheckSquareIcon,
  ActivityIcon,
} from './Icons';
import { api } from '../services/api';

export const UnifiedEmployeeDashboard = ({
  user,
  tasks = [],
  projects = [],
  onOpenNewTask,
  onOpenSubmitModal,
  onOpenReviewModal,
  onTasksUpdated,
}) => {
  const [activePanel, setActivePanel] = useState('submission'); // 'submission' | 'assignment'
  const [authorizedAssignees, setAuthorizedAssignees] = useState([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [newMilestoneText, setNewMilestoneText] = useState({});
  const [addingMilestoneTaskId, setAddingMilestoneTaskId] = useState(null);
  const [submissionFilter, setSubmissionFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const [editingBlockerId, setEditingBlockerId] = useState(null);
  const [blockerInput, setBlockerInput] = useState('');

  const perms = user?.permissions || {};
  const hasAssignPermission = Boolean(perms.canAssignTasks || perms.canCreateTasks || user?.role === 'admin');

  // Load authorized assignees for the assignment panel
  useEffect(() => {
    if (hasAssignPermission) {
      setLoadingAssignees(true);
      api
        .getAuthorizedAssignees()
        .then((data) => setAuthorizedAssignees(Array.isArray(data) ? data : []))
        .catch((err) => console.error('Failed to load authorized assignees:', err))
        .finally(() => setLoadingAssignees(false));
    }
  }, [hasAssignPermission]);

  const triggerNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const triggerError = (msg) => {
    setErrorNotice(msg);
    setTimeout(() => setErrorNotice(''), 5000);
  };

  const userIdStr = (user?._id || user?.id || '').toString();

  // Tasks assigned TO current employee (Submission Panel)
  const myAssignedTasks = tasks.filter((t) => {
    const assignedToId = t.assignedTo?._id || t.assignedTo?.id || t.assignedTo;
    return assignedToId && assignedToId.toString() === userIdStr;
  });

  // Tasks assigned BY current employee to reporting subordinates (Assignment Panel)
  const myDelegatedTasks = tasks.filter((t) => {
    const assignedById = t.assignedBy?._id || t.assignedBy?.id || t.assignedBy;
    const assignedToId = t.assignedTo?._id || t.assignedTo?.id || t.assignedTo;
    // Assigned by this user to someone else (or self if explicit)
    return assignedById && assignedById.toString() === userIdStr && assignedToId?.toString() !== userIdStr;
  });

  // Complete milestone handler
  const handleCompleteMilestone = async (taskId, milestoneId) => {
    try {
      const res = await api.completeMilestone(taskId, milestoneId);
      triggerNotice(res.message || 'Milestone marked as complete.');
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to complete milestone.');
    }
  };

  // Add milestone to task handler
  const handleAddMilestone = async (taskId) => {
    const text = (newMilestoneText[taskId] || '').trim();
    if (!text) return;
    try {
      await api.addMilestone(taskId, text);
      setNewMilestoneText((prev) => ({ ...prev, [taskId]: '' }));
      setAddingMilestoneTaskId(null);
      triggerNotice('Milestone added to task.');
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to add milestone.');
    }
  };

  // Progress update handler
  const handleUpdateProgress = async (taskId, progressVal) => {
    const p = Number(progressVal);
    const newStatus = p === 100 ? 'submitted' : p > 0 ? 'in-progress' : 'not-started';
    try {
      await api.updateTaskProgress(taskId, { progress: p, status: newStatus });
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to update progress.');
    }
  };

  // Blocker update handlers
  const handleSaveBlocker = async (taskId) => {
    if (!blockerInput.trim()) return;
    try {
      await api.updateTaskProgress(taskId, { blocker: blockerInput.trim() });
      setEditingBlockerId(null);
      setBlockerInput('');
      triggerNotice('Impediment / Blocker flagged for supervisor.');
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to flag blocker.');
    }
  };

  const handleResolveBlocker = async (taskId) => {
    try {
      await api.updateTaskProgress(taskId, { blocker: '' });
      triggerNotice('Blocker marked as resolved.');
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to clear blocker.');
    }
  };

  // Filter tasks
  const filteredSubmissionTasks = myAssignedTasks.filter((t) => {
    if (submissionFilter === 'all') return true;
    return t.status === submissionFilter;
  });

  const filteredAssignmentTasks = myDelegatedTasks.filter((t) => {
    if (assignmentFilter === 'all') return true;
    return t.status === assignmentFilter;
  });

  return (
    <div className="unified-employee-dashboard animate-fade-in">
      {/* Toast Notices */}
      {notice && (
        <div className="notice-banner success-banner animate-fade-in">
          <CheckCircleIcon size={16} /> <span>{notice}</span>
        </div>
      )}
      {errorNotice && (
        <div className="notice-banner error-banner animate-fade-in">
          <AlertTriangleIcon size={16} /> <span>{errorNotice}</span>
        </div>
      )}

      {/* Employee Context Banner */}
      <div className="employee-context-header">
        <div className="context-left">
          <div className="header-icon-badge">
            <SparklesIcon size={24} className="text-primary" />
          </div>
          <div>
            <h2>
              Welcome, {user?.firstName} {user?.lastName}
            </h2>
            <div className="employee-badges-row">
              <span className="badge-role">{user?.designation || user?.role || 'Team Member'}</span>
              <span className="badge-dept">{user?.department || 'General'}</span>
              {user?.employeeId && (
                <span className="badge-empid">ID: {user.employeeId}</span>
              )}
              {user?.reportsTo && (
                <span className="badge-supervisor">
                  Reports to: {user.reportsTo.firstName ? `${user.reportsTo.firstName} ${user.reportsTo.lastName}` : 'Supervisor'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Unified Dashboard Mode Switcher Tabs */}
        <div className="unified-panel-tabs">
          <button
            type="button"
            className={`panel-tab-btn ${activePanel === 'submission' ? 'active' : ''}`}
            onClick={() => setActivePanel('submission')}
          >
            <CheckSquareIcon size={16} />
            <span>Submission Panel (My Work)</span>
            <span className="tab-count-pill">{myAssignedTasks.length}</span>
          </button>

          <button
            type="button"
            className={`panel-tab-btn ${activePanel === 'assignment' ? 'active' : ''} ${!hasAssignPermission ? 'btn-tab-locked' : ''}`}
            onClick={() => setActivePanel('assignment')}
            title={!hasAssignPermission ? 'Assignment permission required' : 'Assign & monitor tasks to subordinates'}
          >
            {hasAssignPermission ? <UsersIcon size={16} /> : <LockIcon size={14} />}
            <span>Assignment Panel</span>
            {hasAssignPermission ? (
              <span className="tab-count-pill">{myDelegatedTasks.length}</span>
            ) : (
              <span className="tab-locked-pill">Locked</span>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================
          SECTION 1: SUBMISSION PANEL (My Assigned Work)
          ========================================================= */}
      {activePanel === 'submission' && (
        <div className="submission-panel-section animate-fade-in">
          <div className="panel-controls-bar">
            <div className="filter-pills-row">
              <span className="filter-label">Filter:</span>
              <button
                type="button"
                className={`filter-pill ${submissionFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSubmissionFilter('all')}
              >
                All ({myAssignedTasks.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${submissionFilter === 'not-started' ? 'active' : ''}`}
                onClick={() => setSubmissionFilter('not-started')}
              >
                To Do ({myAssignedTasks.filter((t) => t.status === 'not-started').length})
              </button>
              <button
                type="button"
                className={`filter-pill ${submissionFilter === 'in-progress' ? 'active' : ''}`}
                onClick={() => setSubmissionFilter('in-progress')}
              >
                In Progress ({myAssignedTasks.filter((t) => t.status === 'in-progress').length})
              </button>
              <button
                type="button"
                className={`filter-pill ${submissionFilter === 'submitted' ? 'active' : ''}`}
                onClick={() => setSubmissionFilter('submitted')}
              >
                In Review ({myAssignedTasks.filter((t) => t.status === 'submitted').length})
              </button>
              <button
                type="button"
                className={`filter-pill ${submissionFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setSubmissionFilter('completed')}
              >
                Completed ({myAssignedTasks.filter((t) => t.status === 'completed').length})
              </button>
            </div>
          </div>

          {filteredSubmissionTasks.length === 0 ? (
            <div className="empty-panel-card">
              <CheckCircleIcon size={44} className="text-success" />
              <h3>No assigned tasks in this view</h3>
              <p>You have no pending tasks assigned at this moment. You are completely caught up!</p>
            </div>
          ) : (
            <div className="tasks-cards-grid">
              {filteredSubmissionTasks.map((t) => {
                const isCompleted = t.status === 'completed';
                const isSubmitted = t.status === 'submitted';
                const isOverdue =
                  (t.deadline || t.dueDate) &&
                  (t.deadline || t.dueDate) < new Date().toISOString().split('T')[0] &&
                  !isCompleted;
                const milestones = Array.isArray(t.milestones) ? t.milestones : [];
                const completedMilestonesCount = milestones.filter((m) => m.completed).length;

                return (
                  <div
                    key={t._id || t.id}
                    className={`unified-task-card ${isCompleted ? 'card-completed' : ''} ${isOverdue ? 'card-overdue' : ''}`}
                  >
                    {/* Top Row */}
                    <div className="task-card-top-row">
                      <span className={`priority-tag priority-${t.priority || 'medium'}`}>
                        {(t.priority || 'medium').toUpperCase()} · {t.weight || 1}X WEIGHT
                      </span>
                      <span className={`status-badge-unified status-${t.status || 'not-started'}`}>
                        {(t.status || 'not-started').replace('-', ' ').toUpperCase()}
                      </span>
                    </div>

                    <h3 className="task-title-unified">{t.title}</h3>
                    {t.description && <p className="task-desc-unified">{t.description}</p>}

                    {/* Metadata */}
                    <div className="task-meta-bar">
                      <span>
                        <UserIcon size={13} /> Assigned By: <strong>{t.assignedByName || 'Supervisor'}</strong>
                      </span>
                      <span className={isOverdue ? 'text-danger' : ''}>
                        <CalendarIcon size={13} /> Due: <strong>{t.deadline || t.dueDate || 'Flexible'}</strong>
                        {isOverdue && ' (Overdue)'}
                      </span>
                    </div>

                    {/* Supervisor Feedback */}
                    {t.reviewFeedback && (
                      <div className={`feedback-banner ${isCompleted ? 'feedback-approved' : 'feedback-revision'}`}>
                        <strong>Supervisor Feedback:</strong>
                        <p>{t.reviewFeedback}</p>
                      </div>
                    )}

                    {/* Blocker Impediment Display */}
                    {t.blocker ? (
                      <div className="blocker-warning-box">
                        <div className="blocker-text-col">
                          <AlertTriangleIcon size={16} className="text-danger" />
                          <span><strong>Active Blocker:</strong> {t.blocker}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-resolve-blocker"
                          onClick={() => handleResolveBlocker(t._id || t.id)}
                        >
                          Resolve
                        </button>
                      </div>
                    ) : editingBlockerId === (t._id || t.id) ? (
                      <div className="blocker-input-row">
                        <input
                          type="text"
                          placeholder="What is blocking your progress? (e.g. awaiting assets)"
                          value={blockerInput}
                          onChange={(e) => setBlockerInput(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveBlocker(t._id || t.id)}
                        >
                          Flag
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingBlockerId(null);
                            setBlockerInput('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      !isCompleted && !isSubmitted && (
                        <button
                          type="button"
                          className="btn-flag-blocker-link"
                          onClick={() => {
                            setEditingBlockerId(t._id || t.id);
                            setBlockerInput('');
                          }}
                        >
                          <AlertTriangleIcon size={13} /> Flag an Impediment / Blocker
                        </button>
                      )
                    )}

                    {/* ================= MILESTONES SECTION ================= */}
                    <div className="task-milestones-container">
                      <div className="milestones-header-row">
                        <strong>
                          Milestones ({completedMilestonesCount} / {milestones.length} completed)
                        </strong>
                        {!isCompleted && (
                          <button
                            type="button"
                            className="btn-add-milestone-text"
                            onClick={() =>
                              setAddingMilestoneTaskId(
                                addingMilestoneTaskId === (t._id || t.id) ? null : (t._id || t.id)
                              )
                            }
                          >
                            + Add Milestone
                          </button>
                        )}
                      </div>

                      {/* Add Milestone Inline Input */}
                      {addingMilestoneTaskId === (t._id || t.id) && (
                        <div className="add-milestone-input-row">
                          <input
                            type="text"
                            placeholder="Milestone title (e.g. Phase 1 Draft deliverable)"
                            value={newMilestoneText[t._id || t.id] || ''}
                            onChange={(e) =>
                              setNewMilestoneText({
                                ...newMilestoneText,
                                [t._id || t.id]: e.target.value,
                              })
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAddMilestone(t._id || t.id)}
                          >
                            Add
                          </button>
                        </div>
                      )}

                      {/* Milestones List */}
                      {milestones.length === 0 ? (
                        <p className="no-milestones-muted">No specific milestones tracked for this task.</p>
                      ) : (
                        <div className="milestones-list">
                          {milestones.map((m) => {
                            const isDone = Boolean(m.completed);
                            return (
                              <div
                                key={m.id || m._id}
                                className={`milestone-item-row ${isDone ? 'milestone-completed' : 'milestone-pending'}`}
                              >
                                <div className="milestone-left">
                                  {isDone ? (
                                    <CheckCircleIcon size={16} className="text-success" />
                                  ) : (
                                    <span className="milestone-pending-dot">○</span>
                                  )}
                                  <div className="milestone-details">
                                    <span className={`milestone-title ${isDone ? 'line-through' : ''}`}>
                                      {m.title}
                                    </span>
                                    {isDone && m.completedAt && (
                                      <small className="milestone-completed-time">
                                        Completed on {new Date(m.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        {m.completedByName && ` by ${m.completedByName}`}
                                      </small>
                                    )}
                                  </div>
                                </div>

                                <div className="milestone-right-action">
                                  {isDone ? (
                                    <span className="milestone-done-pill">✓ Done</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-success btn-sm btn-complete-milestone"
                                      onClick={() => handleCompleteMilestone(t._id || t.id, m.id || m._id)}
                                      title="Mark this milestone as completed"
                                    >
                                      <CheckIcon size={13} /> Complete
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Progress Slider */}
                    <div className="progress-control-block">
                      <div className="progress-labels">
                        <span>Task Completion Progress</span>
                        <strong>{isCompleted ? 100 : t.progress || 0}%</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={isCompleted ? 100 : t.progress || 0}
                        disabled={isCompleted || isSubmitted}
                        onChange={(e) => handleUpdateProgress(t._id || t.id, e.target.value)}
                        className="unified-slider"
                      />
                    </div>

                    {/* Action Submission Button */}
                    <div className="task-footer-action">
                      {isCompleted ? (
                        <div className="badge-approved-stamp">
                          <CheckCircleIcon size={16} /> Work Approved by Supervisor
                        </div>
                      ) : isSubmitted ? (
                        <div className="badge-submitted-stamp">
                          ⏳ Work Submitted · In Review with Supervisor
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-block"
                          onClick={() => onOpenSubmitModal(t)}
                        >
                          <CheckCircleIcon size={16} /> Submit Deliverable for Supervisor Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          SECTION 2: ASSIGNMENT PANEL (Delegation & Supervision)
          ========================================================= */}
      {activePanel === 'assignment' && (
        <div className="assignment-panel-section animate-fade-in">
          {!hasAssignPermission ? (
            <div className="permission-restricted-card animate-scale-up">
              <div className="lock-icon-circle">
                <LockIcon size={32} />
              </div>
              <h3>Assignment Panel Restricted</h3>
              <p>
                Your account is currently configured with <strong>Submission Panel access only</strong> (operational execution & milestone delivery).
              </p>
              <p className="restricted-subtext">
                Task assignment and delegation are controlled by organizational permissions. To delegate tasks to reporting team members, an administrator can grant assignment permission in workspace settings.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActivePanel('submission')}
              >
                Go to My Submission Panel
              </button>
            </div>
          ) : (
            <div>
              {/* Assignment Controls Bar */}
              <div className="panel-controls-bar">
                <div className="assignment-info-text">
                  <h4>Authorized Reporting Team</h4>
                  <small>
                    {authorizedAssignees.length === 0
                      ? 'No subordinates reporting directly to your position in the organizational tree.'
                      : `You can assign tasks to ${authorizedAssignees.length} reporting employee${authorizedAssignees.length > 1 ? 's' : ''}: ${authorizedAssignees.map((a) => `${a.firstName} ${a.lastName}`).join(', ')}`}
                  </small>
                </div>

                <div className="assignment-actions-right">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onOpenNewTask()}
                  >
                    <PlusIcon size={15} /> Assign New Task
                  </button>
                </div>
              </div>

              {/* Filter pills */}
              <div className="filter-pills-row" style={{ marginBottom: '18px' }}>
                <span className="filter-label">Filter:</span>
                <button
                  type="button"
                  className={`filter-pill ${assignmentFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setAssignmentFilter('all')}
                >
                  All Delegated ({myDelegatedTasks.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${assignmentFilter === 'in-progress' ? 'active' : ''}`}
                  onClick={() => setAssignmentFilter('in-progress')}
                >
                  Active ({myDelegatedTasks.filter((t) => t.status === 'in-progress' || t.status === 'not-started').length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${assignmentFilter === 'submitted' ? 'active' : ''}`}
                  onClick={() => setAssignmentFilter('submitted')}
                >
                  Pending Review ({myDelegatedTasks.filter((t) => t.status === 'submitted').length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${assignmentFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setAssignmentFilter('completed')}
                >
                  Approved ({myDelegatedTasks.filter((t) => t.status === 'completed').length})
                </button>
              </div>

              {/* Delegated Tasks Grid */}
              {filteredAssignmentTasks.length === 0 ? (
                <div className="empty-panel-card">
                  <UsersIcon size={44} className="text-muted" />
                  <h3>No delegated tasks</h3>
                  <p>You have not delegated any tasks to your reporting team members yet.</p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenNewTask()}
                    style={{ marginTop: '12px' }}
                  >
                    Assign First Task
                  </button>
                </div>
              ) : (
                <div className="tasks-cards-grid">
                  {filteredAssignmentTasks.map((t) => {
                    const isSubmitted = t.status === 'submitted';
                    const isCompleted = t.status === 'completed';
                    const milestones = Array.isArray(t.milestones) ? t.milestones : [];
                    const completedMilestones = milestones.filter((m) => m.completed).length;

                    return (
                      <div
                        key={t._id || t.id}
                        className={`unified-task-card ${isSubmitted ? 'card-pending-review' : ''}`}
                      >
                        <div className="task-card-top-row">
                          <span className={`priority-tag priority-${t.priority || 'medium'}`}>
                            {(t.priority || 'medium').toUpperCase()}
                          </span>
                          <span className={`status-badge-unified status-${t.status || 'not-started'}`}>
                            {(t.status || 'not-started').replace('-', ' ').toUpperCase()}
                          </span>
                        </div>

                        <h3 className="task-title-unified">{t.title}</h3>
                        {t.description && <p className="task-desc-unified">{t.description}</p>}

                        <div className="task-meta-bar">
                          <span>
                            <UserIcon size={13} /> Assigned To:{' '}
                            <strong>{t.assignedToName || 'Unassigned'}</strong>
                          </span>
                          <span>
                            <CalendarIcon size={13} /> Due:{' '}
                            <strong>{t.deadline || t.dueDate || 'Flexible'}</strong>
                          </span>
                        </div>

                        {/* Blocker Alert */}
                        {t.blocker && (
                          <div className="blocker-warning-box">
                            <AlertTriangleIcon size={16} className="text-danger" />
                            <span><strong>Subordinate Blocker:</strong> {t.blocker}</span>
                          </div>
                        )}

                        {/* Submission Deliverable Alert */}
                        {isSubmitted && t.submissionNotes && (
                          <div className="deliverable-review-notice">
                            <strong>Deliverable Submitted by {t.assignedToName}:</strong>
                            <p>{t.submissionNotes}</p>
                          </div>
                        )}

                        {/* Milestones Progress */}
                        {milestones.length > 0 && (
                          <div className="assigned-milestones-summary">
                            <small>
                              Milestones Progress: {completedMilestones} / {milestones.length} completed
                            </small>
                            <div className="mini-progress-bar">
                              <div
                                className="mini-progress-fill"
                                style={{ width: `${(completedMilestones / milestones.length) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* Progress Bar */}
                        <div className="progress-control-block">
                          <div className="progress-labels">
                            <span>Subordinate Progress</span>
                            <strong>{t.progress || 0}%</strong>
                          </div>
                          <div className="custom-progress-track">
                            <div
                              className="custom-progress-indicator"
                              style={{ width: `${t.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Review Action */}
                        <div className="task-footer-action">
                          {isSubmitted ? (
                            <button
                              type="button"
                              className="btn btn-success btn-block"
                              onClick={() => onOpenReviewModal(t)}
                            >
                              <CheckCircleIcon size={16} /> Review Submitted Deliverable
                            </button>
                          ) : isCompleted ? (
                            <div className="badge-approved-stamp">
                              ✓ Approved by You
                            </div>
                          ) : (
                            <div className="subordinate-working-stamp">
                              <ActivityIcon size={14} /> Subordinate Working on Deliverables
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
