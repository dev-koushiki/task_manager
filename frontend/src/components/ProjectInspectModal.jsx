import { useState } from 'react';
import {
  CalendarIcon,
  UserIcon,
  AlertTriangleIcon,
  CornerDownRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LayersIcon,
  SearchIcon,
  SparklesIcon,
} from './Icons';

export const ProjectInspectModal = ({ isOpen, onClose, project, tasks = [] }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedMap, setExpandedMap] = useState({});

  if (!isOpen || !project) return null;

  const projId = project.id || project._id;
  const projectTasks = tasks.filter(
    (t) =>
      t.projectId === projId ||
      t.projectId?._id === projId ||
      String(t.projectId) === String(projId)
  );

  const progress = project.progressPercentage ?? (project.metrics?.progressPercentage || 0);
  const status = project.status || project.metrics?.calculatedStatus || 'on-track';

  // Aggregate milestone details
  let totalMilestonesCount = 0;
  let completedMilestonesCount = 0;
  projectTasks.forEach((t) => {
    if (Array.isArray(t.milestones)) {
      totalMilestonesCount += t.milestones.length;
      completedMilestonesCount += t.milestones.filter((m) => m.completed).length;
    }
  });

  const filteredTasks = projectTasks.filter((t) => {
    if (filter === 'completed' && t.status !== 'completed') return false;
    if (filter === 'in-progress' && t.status !== 'in-progress') return false;
    if (filter === 'delayed' && t.status !== 'delayed') return false;
    if (filter === 'submitted' && t.status !== 'submitted') return false;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchAssignee = t.assignedToName?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchDesc) return false;
    }
    return true;
  });

  const toggleExpand = (taskId) => {
    setExpandedMap((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const expandAll = () => {
    const all = {};
    projectTasks.forEach((t) => {
      all[t._id || t.id] = true;
    });
    setExpandedMap(all);
  };

  const collapseAll = () => {
    setExpandedMap({});
  };

  const allExpanded =
    projectTasks.length > 0 &&
    projectTasks.every((t) => expandedMap[t._id || t.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card inspect-modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '960px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="project-badge-tag">EXECUTIVE DRILL-DOWN</span>
              {project.department && (
                <span className="badge-subtle" style={{ fontSize: '11px', padding: '2px 8px' }}>
                  {project.department}
                </span>
              )}
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: 'var(--text-main)' }}>
              {project.name}
            </h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Expected Deliverables & Strategic Objectives Card */}
        <div className="inspect-deliverables-banner">
          <div className="banner-title-row">
            <SparklesIcon size={16} className="text-accent" />
            <strong>Expected Deliverables & Strategic Objectives</strong>
          </div>
          {project.targetOutcome ? (
            <p className="banner-text">
              <strong>Target Deliverables:</strong> {project.targetOutcome}
            </p>
          ) : (
            <p className="banner-text text-muted">
              No specific target deliverable note specified for this project.
            </p>
          )}
          {project.description && (
            <p className="banner-text sub-description">
              <strong>Scope & Objectives:</strong> {project.description}
            </p>
          )}
        </div>

        {/* High-level Project Metrics Grid */}
        <div className="project-meta-grid" style={{ margin: '16px 0 20px' }}>
          <div className="meta-box">
            <span className="meta-label">Project Director</span>
            <span className="meta-value">
              <UserIcon size={14} />
              <strong>{project.directorName || 'Assigned Director'}</strong>
            </span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Target Completion Deadline</span>
            <span className="meta-value">
              <CalendarIcon size={14} />
              <strong>{project.deadline || 'Ongoing'}</strong>
            </span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Calculated Health / Status</span>
            <span className={`status-pill status-${status}`}>
              {status.toUpperCase().replace('-', ' ')}
            </span>
          </div>

          <div className="meta-box">
            <span className="meta-label">Aggregated Progress</span>
            <span className="meta-value">
              <strong>{progress}%</strong>
            </span>
            <div className="mini-progress-track" style={{ marginTop: '4px' }}>
              <div
                className={`mini-progress-fill ${progress === 100 ? 'fill-completed' : ''}`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Deliverables & Milestones Summary Bar */}
        <div className="inspect-table-toolbar">
          <div className="toolbar-left">
            <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Expected Deliverables & Milestone Breakdown ({projectTasks.length})
            </h4>
            <div className="milestones-overall-counter">
              <span className="badge-subtle">
                {completedMilestonesCount} / {totalMilestonesCount} Checkpoints Completed
              </span>
            </div>
          </div>

          <div className="toolbar-right">
            {totalMilestonesCount > 0 && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={allExpanded ? collapseAll : expandAll}
              >
                {allExpanded ? 'Collapse All Milestones' : 'Expand All Milestones'}
              </button>
            )}

            <div className="inspect-search-wrap">
              <SearchIcon size={14} className="inspect-search-icon" />
              <input
                type="text"
                placeholder="Filter deliverables..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="inspect-search-input"
              />
            </div>
          </div>
        </div>

        {/* Structured Deliverables Table */}
        <div className="table-wrapper inspect-table-wrap">
          <table className="task-table inspect-deliverables-table">
            <thead>
              <tr>
                <th style={{ minWidth: '220px' }}>Deliverable</th>
                <th style={{ minWidth: '150px' }}>Assigned To</th>
                <th style={{ minWidth: '200px' }}>Milestones & Progress</th>
                <th style={{ minWidth: '130px' }}>Target Deadline</th>
                <th style={{ width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    <LayersIcon size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>
                      {search || filter !== 'all'
                        ? 'No deliverables match your search criteria.'
                        : 'No underlying tasks or deliverables have been registered under this project yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const taskId = t._id || t.id;
                  const isExpanded = Boolean(expandedMap[taskId]);
                  const tMilestones = Array.isArray(t.milestones) ? t.milestones : [];
                  const tCompletedCount = tMilestones.filter((m) => m.completed).length;
                  const taskProgress = t.status === 'completed' ? 100 : t.progress || 0;

                  return (
                    <tr key={taskId} className="inspect-task-row">
                      {/* 1. Deliverable */}
                      <td>
                        <div className="task-name-cell">
                          {t.parentTaskId && (
                            <CornerDownRightIcon size={14} className="subtask-indent-icon" />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong className="deliverable-title">{t.title}</strong>
                              {t.parentTaskId && (
                                <span className="subtask-tag">Subtask</span>
                              )}
                            </div>
                            {t.description && (
                              <p className="table-desc" style={{ marginTop: '2px', lineHeight: 1.4 }}>
                                {t.description}
                              </p>
                            )}
                            {t.blocker && (
                              <span className="blocker-warning-tag" style={{ marginTop: '4px', display: 'inline-flex' }}>
                                <AlertTriangleIcon size={12} /> Blocker: {t.blocker}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Assigned To */}
                      <td>
                        <span className="assignee-cell">
                          <UserIcon size={14} />
                          <strong>{t.assignedToName || 'Unassigned'}</strong>
                        </span>
                      </td>

                      {/* 3. Milestones & Checkpoints Progress */}
                      <td>
                        <div className="deliverable-milestones-cell">
                          <div className="table-progress-cell" style={{ marginBottom: '4px' }}>
                            <div className="mini-progress-track">
                              <div
                                className={`mini-progress-fill ${taskProgress === 100 ? 'fill-completed' : ''}`}
                                style={{ width: `${taskProgress}%` }}
                              ></div>
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>{taskProgress}%</span>
                          </div>

                          {tMilestones.length > 0 ? (
                            <div>
                              <button
                                type="button"
                                className="milestone-expand-toggle"
                                onClick={() => toggleExpand(taskId)}
                                title="Click to view all checkpoint milestones"
                              >
                                {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                                <span>
                                  <strong>{tCompletedCount} / {tMilestones.length}</strong> milestones completed
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="milestones-drilldown-list animate-fade-in">
                                  {tMilestones.map((m, idx) => (
                                    <div
                                      key={m.id || m._id || idx}
                                      className={`milestone-drilldown-item ${m.completed ? 'completed' : 'pending'}`}
                                    >
                                      <div className="milestone-item-header">
                                        {m.completed ? (
                                          <CheckCircleIcon size={14} className="text-success" />
                                        ) : (
                                          <ClockIcon size={14} className="text-muted" />
                                        )}
                                        <span className={`milestone-title-text ${m.completed ? 'completed-text' : ''}`}>
                                          {m.title}
                                        </span>
                                      </div>
                                      {m.completed && (
                                        <div className="milestone-meta-info">
                                          <span>Done</span>
                                          {m.completedByName && <span> · by {m.completedByName}</span>}
                                          {m.completedAt && (
                                            <span> · {new Date(m.completedAt).toLocaleDateString()}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>
                              Primary deliverable milestone
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Target Deadline */}
                      <td>
                        <span className="date-cell">
                          <CalendarIcon size={13} style={{ marginRight: '4px' }} />
                          {t.deadline || t.dueDate || 'Flexible'}
                        </span>
                      </td>

                      {/* 5. Status */}
                      <td>
                        <span className={`status-pill status-${t.status || 'not-started'}`}>
                          {(t.status || 'not-started').replace('-', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
};
