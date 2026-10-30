import { useState } from 'react';
import {
  CalendarIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
  UserIcon,
  MessageSquareIcon,
  ClockIcon,
} from './Icons';

export const EmployeeWorkView = ({
  tasks = [],
  onUpdateProgress,
  onOpenSubmitModal,
}) => {
  const [editingBlockerId, setEditingBlockerId] = useState(null);
  const [blockerText, setBlockerText] = useState('');

  const handleSliderChange = (taskId, newProgress) => {
    const p = Number(newProgress);
    const newStatus = p === 100 ? 'submitted' : p > 0 ? 'in-progress' : 'not-started';
    onUpdateProgress(taskId, { progress: p, status: newStatus });
  };

  const handleSaveBlocker = (taskId) => {
    onUpdateProgress(taskId, { blocker: blockerText.trim() });
    setEditingBlockerId(null);
    setBlockerText('');
  };

  const handleClearBlocker = (taskId) => {
    onUpdateProgress(taskId, { blocker: '' });
  };

  return (
    <div className="employee-work-view animate-fade-in">
      <div className="employee-header-card">
        <div className="header-icon-badge">
          <SparklesIcon size={24} className="text-accent" />
        </div>
        <div>
          <h2>My Work · Task Execution & Progress Updates</h2>
          <p className="section-desc">
            View your assigned tasks, update real-time progress percentages, flag impediments,
            and submit completed deliverables for supervisor quality sign-off.
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state animate-fade-in" style={{ marginTop: '24px' }}>
          <CheckCircleIcon size={44} className="text-success" />
          <h3>No assigned tasks</h3>
          <p>You have no pending tasks assigned at this moment. Excellent work!</p>
        </div>
      ) : (
        <div className="my-tasks-grid" style={{ marginTop: '24px' }}>
          {tasks.map((t) => {
            const isCompleted = t.status === 'completed';
            const isSubmitted = t.status === 'submitted';
            const isOverdue =
              (t.deadline || t.dueDate) &&
              (t.deadline || t.dueDate) < new Date().toISOString().split('T')[0] &&
              !isCompleted;

            return (
              <div
                key={t._id || t.id}
                className={`my-task-card animate-scale-up ${isCompleted ? 'card-completed' : ''}`}
              >
                <div className="task-top-bar">
                  <span className="task-priority-pill priority-medium">
                    {t.priority ? t.priority.toUpperCase() : 'MEDIUM'} PRIORITY · {t.weight || 1}X WEIGHT
                  </span>
                  <span className={`status-pill status-${t.status || 'not-started'}`}>
                    {(t.status || 'not-started').replace('-', ' ').toUpperCase()}
                  </span>
                </div>

                <h3 className="my-task-title">{t.title}</h3>

                {t.description && (
                  <p className="my-task-desc">{t.description}</p>
                )}

                <div className="task-meta-info-row">
                  <span className="meta-info-item">
                    <UserIcon size={14} /> Assigned By: <strong>{t.assignedByName || 'Supervisor'}</strong>
                  </span>
                  <span className={`meta-info-item ${isOverdue ? 'text-danger' : ''}`}>
                    <CalendarIcon size={14} /> Deadline: <strong>{t.deadline || t.dueDate || 'Flexible'}</strong>
                    {isOverdue && ' (Overdue)'}
                  </span>
                </div>

                {/* Supervisor Feedback Banner & Review Comments */}
                {(t.reviewFeedback || (Array.isArray(t.reviewComments) && t.reviewComments.length > 0)) && (
                  <div className={`supervisor-feedback-card ${isCompleted ? 'feedback-approved' : 'feedback-revision'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <MessageSquareIcon size={14} />
                      <strong>Supervisor Review Feedback & Instructions:</strong>
                    </div>
                    {t.reviewFeedback && <p style={{ margin: '0 0 6px' }}>{t.reviewFeedback}</p>}
                    {Array.isArray(t.reviewComments) && t.reviewComments.length > 0 && (
                      <div className="mini-comments-thread" style={{ marginTop: '8px' }}>
                        {t.reviewComments.map((rc, rIdx) => (
                          <div key={rc._id || rIdx} className="mini-comment-item" style={{ padding: '6px 8px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
                              <span><strong>{rc.authorName || 'Supervisor'}</strong> ({rc.authorRole || 'Reviewer'})</span>
                              {rc.createdAt && <span>{new Date(rc.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
                            </div>
                            <div style={{ marginTop: '2px' }}>{rc.comment}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Blocker Alert Box */}
                {t.blocker ? (
                  <div className="task-blocker-display">
                    <div className="blocker-content">
                      <AlertTriangleIcon size={16} className="text-danger" />
                      <span><strong>Active Blocker:</strong> {t.blocker}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={() => handleClearBlocker(t._id || t.id)}
                      title="Mark blocker as resolved"
                    >
                      Resolve
                    </button>
                  </div>
                ) : editingBlockerId === (t._id || t.id) ? (
                  <div className="blocker-edit-box">
                    <input
                      type="text"
                      placeholder="Describe what is blocking you (e.g. waiting for API keys)..."
                      value={blockerText}
                      onChange={(e) => setBlockerText(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveBlocker(t._id || t.id)}
                      >
                        Flag Blocker
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingBlockerId(null);
                          setBlockerText('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-flag-blocker"
                    onClick={() => {
                      setEditingBlockerId(t._id || t.id);
                      setBlockerText('');
                    }}
                  >
                    <AlertTriangleIcon size={13} /> Flag an Impediment / Blocker
                  </button>
                )}

                {/* Progress Slider */}
                <div className="slider-control-box">
                  <div className="slider-labels">
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
                    onChange={(e) => handleSliderChange(t._id || t.id, e.target.value)}
                    className="progress-slider"
                  />
                </div>

                {/* Action Buttons */}
                <div className="my-task-actions">
                  {isCompleted ? (
                    <div className="completed-stamp">
                      <CheckCircleIcon size={16} /> Deliverable Approved by Supervisor
                    </div>
                  ) : isSubmitted ? (
                    <div className="submitted-stamp">
                      ⏳ Submitted — Pending Supervisor Quality Review
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={() => onOpenSubmitModal(t)}
                    >
                      <CheckCircleIcon size={16} />
                      <span>Submit for Supervisor Review</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
