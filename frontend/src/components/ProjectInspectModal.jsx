import {
  CalendarIcon,
  UserIcon,
  AlertTriangleIcon,
  CornerDownRightIcon,
} from './Icons';

export const ProjectInspectModal = ({ isOpen, onClose, project, tasks = [] }) => {
  if (!isOpen || !project) return null;

  const projectTasks = tasks.filter(
    (t) => t.projectId === (project.id || project._id) || t.projectId?._id === (project.id || project._id)
  );

  const progress = project.progressPercentage ?? (project.metrics?.progressPercentage || 0);
  const status = project.status || project.metrics?.calculatedStatus || 'on-track';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '850px', width: '95%' }}
      >
        <div className="modal-header">
          <div>
            <span className="project-badge-tag">EXECUTIVE DRILL-DOWN</span>
            <h3 style={{ fontSize: '20px', marginTop: '4px' }}>{project.name}</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {project.targetOutcome && (
          <p className="project-outcome-text" style={{ margin: '8px 0 16px' }}>
            <strong>Strategic Target Outcome:</strong> {project.targetOutcome}
          </p>
        )}

        <div className="project-meta-grid" style={{ marginBottom: '18px' }}>
          <div className="meta-box">
            <span className="meta-label">Project Director</span>
            <span className="meta-value">
              <UserIcon size={14} />
              <strong>{project.directorName || 'Assigned Director'}</strong>
            </span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Completion Deadline</span>
            <span className="meta-value">
              <CalendarIcon size={14} />
              <strong>{project.deadline || 'Ongoing'}</strong>
            </span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Calculated Status</span>
            <span className={`status-pill status-${status}`}>
              {status.toUpperCase()}
            </span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Aggregated Progress</span>
            <span className="meta-value">
              <strong>{progress}%</strong>
            </span>
          </div>
        </div>

        {/* Milestone Task Breakdown Table */}
        <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px', textAlign: 'left' }}>
          Underlying Tasks & Milestones ({projectTasks.length})
        </h4>

        <div className="table-wrapper" style={{ maxHeight: '340px', overflowY: 'auto' }}>
          <table className="task-table">
            <thead>
              <tr>
                <th>Deliverable</th>
                <th>Assigned To</th>
                <th>Progress</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projectTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No underlying tasks have been created under this project yet.
                  </td>
                </tr>
              ) : (
                projectTasks.map((t) => (
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
                      <span className="date-cell">
                        {t.deadline || t.dueDate || 'Flexible'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${t.status || 'not-started'}`}>
                        {(t.status || 'not-started').replace('-', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
};
