import { useState } from 'react';
import {
  SparklesIcon,
  PlusIcon,
  CalendarIcon,
  UserIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  TrendingUpIcon,
  LayersIcon,
} from './Icons';

export const AdminSummaryView = ({
  projects = [],
  onOpenNewProject,
  onInspectProject,
  loading = false,
}) => {
  const [filter, setFilter] = useState('all');

  const totalProjects = projects.length;
  const onTrackCount = projects.filter((p) => p.status === 'on-track').length;
  const delayedCount = projects.filter((p) => p.status === 'delayed').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;

  const totalProgress =
    totalProjects > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + (p.progressPercentage || p.metrics?.progressPercentage || 0), 0) /
            totalProjects
        )
      : 0;

  const filteredProjects = projects.filter((p) => {
    const status = p.status || p.metrics?.calculatedStatus;
    if (filter === 'all') return true;
    if (filter === 'on-track') return status === 'on-track';
    if (filter === 'delayed') return status === 'delayed';
    if (filter === 'completed') return status === 'completed';
    return true;
  });

  return (
    <div className="admin-summary-view animate-fade-in">
      {/* Executive Welcome & Actions Header */}
      <div className="summary-header-card">
        <div className="summary-header-left">
          <div className="admin-shield-badge">
            <SparklesIcon size={22} className="text-accent" />
          </div>
          <div>
            <h2>Head of Office · Executive Oversight</h2>
            <p className="section-desc">
              High-level strategic monitoring across all projects, director assignments, and
              aggregated milestone completion rates.
            </p>
          </div>
        </div>

        <div className="summary-header-right">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenNewProject}
          >
            <PlusIcon size={18} />
            <span>Launch New Project</span>
          </button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="metrics-grid" style={{ marginTop: '20px' }}>
        <div className="metric-card animate-scale-up">
          <div className="metric-info">
            <span className="metric-title">Active Projects</span>
            <span className="metric-number">{totalProjects}</span>
          </div>
          <div className="metric-badge bg-blue-subtle">Portfolio</div>
        </div>

        <div className="metric-card animate-scale-up delay-1">
          <div className="metric-info">
            <span className="metric-title">Overall Completion</span>
            <span className="metric-number text-accent">{totalProgress}%</span>
          </div>
          <div className="metric-badge bg-purple-subtle">Weighted Avg</div>
        </div>

        <div className="metric-card animate-scale-up delay-2">
          <div className="metric-info">
            <span className="metric-title">On Track</span>
            <span className="metric-number text-success">{onTrackCount}</span>
          </div>
          <div className="metric-badge bg-emerald-subtle">Meeting Target</div>
        </div>

        <div className="metric-card animate-scale-up delay-3">
          <div className="metric-info">
            <span className="metric-title">Delayed / At Risk</span>
            <span className="metric-number text-danger">{delayedCount}</span>
          </div>
          <div className="metric-badge bg-red-subtle">Requires Attention</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="summary-filter-row">
        <div className="summary-tabs">
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Projects ({totalProjects})
          </button>
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'on-track' ? 'active' : ''}`}
            onClick={() => setFilter('on-track')}
          >
            On Track ({onTrackCount})
          </button>
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'delayed' ? 'active' : ''}`}
            onClick={() => setFilter('delayed')}
          >
            Delayed ({delayedCount})
          </button>
          <button
            type="button"
            className={`summary-tab-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* Projects Matrix */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Compiling executive summaries...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-state animate-fade-in">
          <LayersIcon size={44} className="text-accent" />
          <h3>No projects registered</h3>
          <p>Initialize your first project and assign a Project Director to begin tracking progress.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenNewProject}
            style={{ marginTop: '12px' }}
          >
            <PlusIcon size={18} />
            <span>Launch New Project</span>
          </button>
        </div>
      ) : (
        <div className="project-matrix-grid">
          {filteredProjects.map((p) => {
            const progress = p.progressPercentage ?? (p.metrics?.progressPercentage || 0);
            const status = p.status || p.metrics?.calculatedStatus || 'on-track';
            const completedTasks = p.completedTasks ?? (p.metrics?.completedTasks || 0);
            const totalTasks = p.totalTasks ?? (p.metrics?.totalTasks || 0);
            const overdueTasks = p.overdueTasks ?? (p.metrics?.overdueTasks || 0);

            return (
              <div key={p.id || p._id} className="executive-project-card animate-scale-up">
                <div className="proj-card-header">
                  <div>
                    <span className="project-badge-tag">EXECUTIVE SUMMARY</span>
                    <h3 className="project-name-heading">{p.name}</h3>
                  </div>

                  <span className={`status-pill status-${status}`}>
                    {status === 'completed' && <CheckCircleIcon size={14} />}
                    {status === 'delayed' && <AlertTriangleIcon size={14} />}
                    {status === 'on-track' && <TrendingUpIcon size={14} />}
                    <span style={{ textTransform: 'uppercase' }}>{status.replace('-', ' ')}</span>
                  </span>
                </div>

                {p.targetOutcome && (
                  <p className="project-outcome-text">
                    <strong>Expected Outcome:</strong> {p.targetOutcome}
                  </p>
                )}

                <div className="project-meta-grid">
                  <div className="meta-box">
                    <span className="meta-label">Project Director</span>
                    <span className="meta-value">
                      <UserIcon size={14} />
                      <strong>{p.directorName || 'Assigned Director'}</strong>
                    </span>
                  </div>

                  <div className="meta-box">
                    <span className="meta-label">Target Deadline</span>
                    <span className="meta-value">
                      <CalendarIcon size={14} />
                      <strong>{p.deadline || 'Ongoing'}</strong>
                    </span>
                  </div>

                  <div className="meta-box">
                    <span className="meta-label">Tasks Completed</span>
                    <span className="meta-value">
                      <strong>{completedTasks} / {totalTasks}</strong>
                    </span>
                  </div>

                  <div className="meta-box">
                    <span className="meta-label">Overdue Tasks</span>
                    <span className={`meta-value ${overdueTasks > 0 ? 'text-danger' : ''}`}>
                      {overdueTasks > 0 ? (
                        <>
                          <AlertTriangleIcon size={14} />
                          <strong>{overdueTasks} Overdue</strong>
                        </>
                      ) : (
                        <span>0 Overdue</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="project-progress-wrap">
                  <div className="progress-labels-row">
                    <span className="progress-title">Overall Completion</span>
                    <strong className="progress-pct">{progress}%</strong>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className={`progress-bar-fill ${progress === 100 ? 'fill-completed' : ''}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Card Action Row */}
                <div className="project-card-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onInspectProject(p)}
                  >
                    <span>Inspect Deliverables</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
