import { useState } from 'react';
import {
  PlusIcon,
  CalendarIcon,
  UserIcon,
  AlertTriangleIcon,
  LayersIcon,
  FileTextIcon,
  CornerDownRightIcon,
} from './Icons';

export const ProjectDirectorView = ({
  projects = [],
  tasks = [],
  onOpenNewTask,
  onOpenReview,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return projects.length > 0 ? (projects[0]._id || projects[0].id) : 'all';
  });

  const activeProjects = projects.filter(
    (p) => selectedProjectId === 'all' || p._id === selectedProjectId || p.id === selectedProjectId
  );

  const activeProject = activeProjects[0] || projects[0];

  const projectTasks = tasks.filter((t) => {
    if (selectedProjectId === 'all') return true;
    return t.projectId === selectedProjectId || t.projectId?._id === selectedProjectId;
  });

  // Pending reviews
  const pendingReviews = projectTasks.filter((t) => t.status === 'submitted');
  // Flagged blockers
  const blockedTasks = projectTasks.filter((t) => Boolean(t.blocker));

  return (
    <div className="director-view animate-fade-in">
      {/* Header */}
      <div className="director-header-card">
        <div className="header-left-col">
          <div className="director-badge">
            <LayersIcon size={22} className="text-accent" />
          </div>
          <div>
            <h2>Project Director · Project-Level Management</h2>
            <p className="section-desc">
              Manage project deliverables, assign milestone tasks to Managers and team members,
              monitor blocker alerts, and conduct quality reviews.
            </p>
          </div>
        </div>

        <div className="director-header-actions">
          <select
            className="project-selector"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="all">All My Assigned Projects</option>
            {projects.map((p) => (
              <option key={p._id || p.id} value={p._id || p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenNewTask(activeProject?._id || activeProject?.id)}
          >
            <PlusIcon size={18} />
            <span>Create Milestone / Task</span>
          </button>
        </div>
      </div>

      {/* Review Submissions Queue Banner */}
      {pendingReviews.length > 0 && (
        <div className="pending-reviews-banner animate-slide-up">
          <div className="banner-icon-col">
            <FileTextIcon size={22} className="text-accent" />
          </div>
          <div className="banner-text-col">
            <h4>{pendingReviews.length} Subordinate Deliverable(s) Pending Review</h4>
            <p>Subordinates have submitted completed work. Inspect and approve or request revisions.</p>
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

      {/* Blocker Alert Banner */}
      {blockedTasks.length > 0 && (
        <div className="blocker-alert-banner">
          <AlertTriangleIcon size={20} className="text-danger" />
          <div style={{ flex: 1 }}>
            <strong>{blockedTasks.length} Task(s) Blocked by Impediments:</strong>
            <ul style={{ margin: '4px 0 0 18px', fontSize: '13px' }}>
              {blockedTasks.map((bt) => (
                <li key={bt._id || bt.id}>
                  <strong>{bt.title}:</strong> {bt.blocker} (Responsible: {bt.assignedToName})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Active Project Summary Card */}
      {activeProject && (
        <div className="director-project-summary-box">
          <div className="box-left">
            <span className="director-project-tag">PROJECT MILESTONE SCOPE</span>
            <h3>{activeProject.name}</h3>
            {activeProject.targetOutcome && (
              <p className="outcome-snippet">
                <strong>Expected Outcome:</strong> {activeProject.targetOutcome}
              </p>
            )}
          </div>
          <div className="box-right">
            <div className="box-metric">
              <span>Overall Progress</span>
              <strong>{activeProject.metrics?.progressPercentage || 0}%</strong>
            </div>
            <div className="box-metric">
              <span>Target Deadline</span>
              <strong>{activeProject.deadline || 'Ongoing'}</strong>
            </div>
            <div className="box-metric">
              <span>Status</span>
              <span className={`status-pill status-${activeProject.status || 'on-track'}`}>
                {(activeProject.status || 'on-track').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Tasks Breakdown Table */}
      <div className="table-wrapper" style={{ marginTop: '20px' }}>
        <table className="task-table">
          <thead>
            <tr>
              <th>Task / Milestone</th>
              <th>Assigned To</th>
              <th>Assigned By</th>
              <th>Weight</th>
              <th>Progress</th>
              <th>Deadline</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projectTasks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>
                    No milestone tasks have been broken down for this project yet.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenNewTask(activeProject?._id || activeProject?.id)}
                    style={{ marginTop: '10px' }}
                  >
                    <PlusIcon size={16} /> Add First Task
                  </button>
                </td>
              </tr>
            ) : (
              projectTasks.map((t) => {
                const isOverdue =
                  t.deadline &&
                  t.deadline < new Date().toISOString().split('T')[0] &&
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
                      <span className="supervisor-cell">
                        {t.assignedByName || 'Project Director'}
                      </span>
                    </td>
                    <td>
                      <span className="weight-badge">{t.weight || 1}x</span>
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
                          onClick={() => onOpenNewTask(activeProject?._id, t._id || t.id)}
                          title="Add subtask under this task"
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
