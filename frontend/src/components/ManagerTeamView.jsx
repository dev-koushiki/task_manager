import { useState } from 'react';
import {
  UsersIcon,
  PlusIcon,
  CalendarIcon,
  UserIcon,
  AlertTriangleIcon,
  FileTextIcon,
  CornerDownRightIcon,
} from './Icons';

export const ManagerTeamView = ({
  tasks = [],
  onOpenNewTask,
  onOpenReview,
}) => {
  const [filter, setFilter] = useState('all');

  const pendingReviews = tasks.filter((t) => t.status === 'submitted');
  const delayedTasks = tasks.filter((t) => {
    const today = new Date().toISOString().split('T')[0];
    return (t.deadline || t.dueDate) < today && t.status !== 'completed';
  });

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'pending_review') return t.status === 'submitted';
    if (filter === 'delayed') {
      const today = new Date().toISOString().split('T')[0];
      return (t.deadline || t.dueDate) < today && t.status !== 'completed';
    }
    if (filter === 'in_progress') return t.status === 'in-progress';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <div className="manager-view animate-fade-in">
      {/* Header */}
      <div className="manager-header-card">
        <div className="header-left-col">
          <div className="manager-badge">
            <UsersIcon size={22} className="text-accent" />
          </div>
          <div>
            <h2>Manager & Team Leader · Team Execution Hub</h2>
            <p className="section-desc">
              Assign and divide milestones into subordinate tasks, monitor team deadlines, resolve
              blockers, and inspect and sign off on submitted work.
            </p>
          </div>
        </div>

        <div className="manager-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenNewTask()}
          >
            <PlusIcon size={18} />
            <span>Assign Subtask</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid" style={{ marginTop: '20px' }}>
        <div className="metric-card animate-scale-up">
          <div className="metric-info">
            <span className="metric-title">Team Tasks</span>
            <span className="metric-number">{tasks.length}</span>
          </div>
          <div className="metric-badge bg-blue-subtle">Total Delegated</div>
        </div>

        <div className="metric-card animate-scale-up delay-1">
          <div className="metric-info">
            <span className="metric-title">Pending Sign-off</span>
            <span className="metric-number text-accent">{pendingReviews.length}</span>
          </div>
          <div className="metric-badge bg-purple-subtle">Needs Review</div>
        </div>

        <div className="metric-card animate-scale-up delay-2">
          <div className="metric-info">
            <span className="metric-title">In Progress</span>
            <span className="metric-number text-success">
              {tasks.filter((t) => t.status === 'in-progress').length}
            </span>
          </div>
          <div className="metric-badge bg-emerald-subtle">Active Work</div>
        </div>

        <div className="metric-card animate-scale-up delay-3">
          <div className="metric-info">
            <span className="metric-title">Delayed</span>
            <span className="metric-number text-danger">{delayedTasks.length}</span>
          </div>
          <div className="metric-badge bg-red-subtle">Past Deadline</div>
        </div>
      </div>

      {/* Review Queue Banner */}
      {pendingReviews.length > 0 && (
        <div className="pending-reviews-banner animate-slide-up" style={{ marginTop: '20px' }}>
          <div className="banner-icon-col">
            <FileTextIcon size={22} className="text-accent" />
          </div>
          <div className="banner-text-col">
            <h4>{pendingReviews.length} Subordinate Submission(s) Ready for Approval</h4>
            <p>Verify deliverables against quality standards before marking completed.</p>
          </div>
          <div className="banner-items-list">
            {pendingReviews.map((t) => (
              <div key={t._id || t.id} className="review-queue-pill">
                <span>{t.title} ({t.assignedToName})</span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onOpenReview(t)}
                >
                  Review Work
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="summary-filter-row" style={{ marginTop: '20px' }}>
        <div className="summary-tabs">
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Work ({tasks.length})
          </button>
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'pending_review' ? 'active' : ''}`}
            onClick={() => setFilter('pending_review')}
          >
            Pending Review ({pendingReviews.length})
          </button>
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'delayed' ? 'active' : ''}`}
            onClick={() => setFilter('delayed')}
          >
            Delayed ({delayedTasks.length})
          </button>
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Team Tasks Table */}
      <div className="table-wrapper" style={{ marginTop: '16px' }}>
        <table className="task-table">
          <thead>
            <tr>
              <th>Task / Subtask</th>
              <th>Assigned Subordinate</th>
              <th>Progress</th>
              <th>Deadline</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No tasks match the selected filter.</p>
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => {
                const isOverdue =
                  (t.deadline || t.dueDate) &&
                  (t.deadline || t.dueDate) < new Date().toISOString().split('T')[0] &&
                  t.status !== 'completed';

                return (
                  <tr key={t._id || t.id}>
                    <td>
                      <div className="task-name-cell">
                        {t.parentTaskId && (
                          <CornerDownRightIcon size={14} className="subtask-indent-icon" />
                        )}
                        <div>
                          <strong>{t.title}</strong>
                          {t.blocker && (
                            <span className="blocker-warning-tag">
                              <AlertTriangleIcon size={12} /> {t.blocker}
                            </span>
                          )}
                          {t.reviewFeedback && (
                            <small className="feedback-hint">
                              Supervisor note: {t.reviewFeedback}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="assignee-cell">
                        <UserIcon size={14} />
                        {t.assignedToName || 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <div className="table-progress-cell">
                        <div className="mini-progress-track">
                          <div
                            className="mini-progress-fill"
                            style={{ width: `${t.status === 'completed' ? 100 : t.progress || 0}%` }}
                          ></div>
                        </div>
                        <span>{t.status === 'completed' ? 100 : t.progress || 0}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`date-cell ${isOverdue ? 'text-danger' : ''}`}>
                        <CalendarIcon size={13} />
                        {t.deadline || t.dueDate || 'Flexible'}
                        {isOverdue && ' (Overdue)'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${t.status || 'not-started'}`}>
                        {(t.status || 'not-started').replace('-', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {t.status === 'submitted' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onOpenReview(t)}
                        >
                          Review
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenNewTask(t.projectId, t._id || t.id)}
                        >
                          + Subtask
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
