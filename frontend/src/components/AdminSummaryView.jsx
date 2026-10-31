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
  EyeIcon,
  SearchIcon,
} from './Icons';

export const AdminSummaryView = ({
  projects = [],
  tasks = [],
  onOpenNewProject,
  onInspectProject,
  loading = false,
}) => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const totalProjects = projects.length;
  const onTrackCount = projects.filter((p) => (p.status || p.metrics?.calculatedStatus) === 'on-track').length;
  const delayedCount = projects.filter((p) => (p.status || p.metrics?.calculatedStatus) === 'delayed').length;
  const completedCount = projects.filter((p) => (p.status || p.metrics?.calculatedStatus) === 'completed').length;

  const totalProgress =
    totalProjects > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + (p.progressPercentage ?? p.metrics?.progressPercentage ?? 0), 0) /
            totalProjects
        )
      : 0;

  const filteredProjects = projects.filter((p) => {
    const status = p.status || p.metrics?.calculatedStatus || 'not-started';
    if (filter === 'on-track' && status !== 'on-track') return false;
    if (filter === 'delayed' && status !== 'delayed') return false;
    if (filter === 'completed' && status !== 'completed') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchDirector = p.directorName?.toLowerCase().includes(q);
      const matchDept = p.department?.toLowerCase().includes(q);
      const matchOutcome = p.targetOutcome?.toLowerCase().includes(q);
      if (!matchName && !matchDirector && !matchDept && !matchOutcome) return false;
    }

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

      {/* Filter Tabs & Search Controls */}
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

        <div className="overview-search-wrap">
          <SearchIcon size={16} className="overview-search-icon" />
          <input
            type="text"
            className="overview-search-input"
            placeholder="Search projects, directors, departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Overview Projects Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Compiling executive summaries...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-state animate-fade-in">
          <LayersIcon size={44} className="text-accent" />
          <h3>No projects found</h3>
          <p>
            {searchQuery || filter !== 'all'
              ? 'No projects match your current filters. Try resetting search or filter.'
              : 'Initialize your first project and assign a Project Director to begin tracking progress.'}
          </p>
          {searchQuery || filter !== 'all' ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFilter('all');
                setSearchQuery('');
              }}
              style={{ marginTop: '12px' }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenNewProject}
              style={{ marginTop: '12px' }}
            >
              <PlusIcon size={18} />
              <span>Launch New Project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper overview-table-wrapper animate-fade-in">
          <table className="task-table project-overview-table">
            <thead>
              <tr>
                <th style={{ minWidth: '240px' }}>Project Name</th>
                <th style={{ minWidth: '180px' }}>Director</th>
                <th style={{ minWidth: '140px' }}>Target Deadline</th>
                <th style={{ minWidth: '180px' }}>Tasks Completed</th>
                <th style={{ width: '110px', textAlign: 'center' }}>View</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p) => {
                const projId = p._id || p.id;
                const progress = p.progressPercentage ?? (p.metrics?.progressPercentage || 0);
                const status = p.status || p.metrics?.calculatedStatus || 'on-track';

                // Calculate task metrics accurately from project or tasks array
                const projectTasks = Array.isArray(tasks)
                  ? tasks.filter(
                      (t) =>
                        t.projectId === projId ||
                        t.projectId?._id === projId ||
                        t.projectId === String(projId)
                    )
                  : [];

                const completedTasks =
                  p.completedTasks ??
                  (p.metrics?.completedTasks !== undefined
                    ? p.metrics.completedTasks
                    : projectTasks.filter((t) => t.status === 'completed').length);

                const totalTasks =
                  p.totalTasks ??
                  (p.metrics?.totalTasks !== undefined
                    ? p.metrics.totalTasks
                    : projectTasks.length);

                return (
                  <tr key={projId} className="project-overview-row">
                    {/* 1. Project Name */}
                    <td>
                      <div className="project-name-cell">
                        <div className="project-title-row">
                          <strong className="project-table-title">{p.name}</strong>
                          <span className={`status-pill status-${status} project-status-pill`}>
                            {status === 'completed' && <CheckCircleIcon size={12} />}
                            {status === 'delayed' && <AlertTriangleIcon size={12} />}
                            {status === 'on-track' && <TrendingUpIcon size={12} />}
                            <span style={{ textTransform: 'uppercase' }}>
                              {status.replace('-', ' ')}
                            </span>
                          </span>
                        </div>
                        {p.targetOutcome && (
                          <p className="project-table-outcome" title={p.targetOutcome}>
                            <span className="outcome-tag">Deliverables:</span> {p.targetOutcome}
                          </p>
                        )}
                        {p.department && (
                          <span className="project-table-dept">Dept: {p.department}</span>
                        )}
                      </div>
                    </td>

                    {/* 2. Director */}
                    <td>
                      <div className="director-cell">
                        <div className="director-avatar-chip">
                          <UserIcon size={14} />
                        </div>
                        <div className="director-info">
                          <strong className="director-name">
                            {p.directorName || 'Assigned Director'}
                          </strong>
                        </div>
                      </div>
                    </td>

                    {/* 3. Target Deadline */}
                    <td>
                      <div className="deadline-cell">
                        <CalendarIcon size={14} className="deadline-icon" />
                        <span className="deadline-date">{p.deadline || 'Ongoing'}</span>
                      </div>
                    </td>

                    {/* 4. Tasks Completed */}
                    <td>
                      <div className="tasks-completed-cell">
                        <div className="tasks-count-row">
                          <span className="tasks-completed-count">
                            <strong>{completedTasks}</strong> / {totalTasks} tasks
                          </span>
                          <span className="tasks-completed-pct">{progress}%</span>
                        </div>
                        <div className="mini-progress-track">
                          <div
                            className={`mini-progress-fill ${progress === 100 ? 'fill-completed' : ''}`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* 5. View */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm project-view-btn"
                        onClick={() => onInspectProject(p)}
                        title={`View drill-down for ${p.name}`}
                      >
                        <EyeIcon size={14} />
                        <span>View</span>
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
  );
};
