import { useState, useEffect } from 'react';
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  LogOutIcon,
  BuildingIcon,
  BriefcaseIcon,
  CalendarIcon,
  SparklesIcon,
  UsersIcon,
  UserIcon,
  LayersIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ShieldIcon,
} from './Icons';
import { TaskModal } from './TaskModal';
import { ProjectModal } from './ProjectModal';
import { TaskReviewModal } from './TaskReviewModal';
import { SubmitWorkModal } from './SubmitWorkModal';
import { ProjectInspectModal } from './ProjectInspectModal';
import { AdminSummaryView } from './AdminSummaryView';
import { ProjectDirectorView } from './ProjectDirectorView';
import { ManagerTeamView } from './ManagerTeamView';
import { EmployeeWorkView } from './EmployeeWorkView';
import { OrganizationStructureBuilder } from './OrganizationStructureBuilder';
import { AdminEmployeePanel } from './AdminEmployeePanel';
import { ThemeToggle } from './ThemeToggle';
import { api } from '../services/api';

export const Dashboard = ({ user, onLogout, theme, onToggleTheme, onTestAcceptInvite, onUpdateUser }) => {
  const userRole = user?.role || 'employee';
  const perms = user?.permissions || {};
  const isAdmin = userRole === 'admin';
  const canViewSummary = isAdmin || Boolean(perms.canViewExecutiveSummary);
  const canManageEmployees = isAdmin || Boolean(perms.canManageEmployees);
  const canManageStructure = isAdmin || Boolean(perms.canManageStructure);
  const canManageProjects = isAdmin || userRole === 'director' || Boolean(perms.canCreateProjects);
  const canManageTeams = isAdmin || userRole === 'manager' || Boolean(perms.canAssignTasks || perms.canApproveTasks || perms.canApproveWork);

  // Profile management states
  const [profileTab, setProfileTab] = useState('overview'); // 'overview' | 'edit' | 'security'
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    designation: user?.designation || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Active navigation tab governed strictly by user authorization
  const [activeTab, setActiveTab] = useState(() => {
    if (isAdmin || canViewSummary) return 'summary';
    if (canManageProjects) return 'director_view';
    if (canManageTeams) return 'manager_view';
    return 'employee_view';
  });

  // Data states
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter and display states for general tasks view
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'

  // Modal states
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskModalProjectId, setTaskModalProjectId] = useState('');
  const [taskModalParentId, setTaskModalParentId] = useState(null);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingTask, setReviewingTask] = useState(null);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(null);

  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [inspectingProject, setInspectingProject] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getProjects(),
      api.getTasks(),
      api.getAdminEmployees(),
    ])
      .then(([projectsData, tasksData, adminData]) => {
        if (active) {
          setProjects(projectsData || []);
          setTasks(tasksData || []);
          setEmployees(adminData?.employees || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshAllData = async () => {
    try {
      const [projectsData, tasksData, adminData] = await Promise.all([
        api.getProjects(),
        api.getTasks(),
        api.getAdminEmployees(),
      ]);
      setProjects(projectsData || []);
      setTasks(tasksData || []);
      setEmployees(adminData?.employees || []);
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
    }
  };

  // Project Actions
  const handleSaveProject = async (projectData) => {
    if (editingProject) {
      await api.updateProject(editingProject._id || editingProject.id, projectData);
    } else {
      await api.createProject(projectData);
    }
    setEditingProject(null);
    setIsProjectModalOpen(false);
    refreshAllData();
  };

  // Task Actions
  const handleOpenNewTask = (projectId = '', parentTaskId = null) => {
    setEditingTask(null);
    setTaskModalProjectId(projectId || (projects.length > 0 ? (projects[0]._id || projects[0].id) : ''));
    setTaskModalParentId(parentTaskId || null);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData) => {
    if (editingTask) {
      await api.updateTask(editingTask._id || editingTask.id, taskData);
    } else {
      await api.createTask({
        ...taskData,
        projectId: taskData.projectId || taskModalProjectId,
        parentTaskId: taskData.parentTaskId || taskModalParentId,
      });
    }
    setEditingTask(null);
    setIsTaskModalOpen(false);
    refreshAllData();
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(id);
      refreshAllData();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  };

  // Progress update from Employee view or quick changer
  const handleUpdateProgress = async (taskId, progressData) => {
    try {
      await api.updateTaskProgress(taskId, progressData);
      refreshAllData();
    } catch (err) {
      console.error('Progress update failed:', err);
    }
  };

  // Submit deliverable for review
  const handleSubmitWork = async (taskId, submissionNotes) => {
    try {
      await api.submitTaskForReview(taskId, submissionNotes);
      refreshAllData();
    } catch (err) {
      alert(err.message || 'Submission failed');
    }
  };

  // Supervisor review action (approve or request revisions)
  const handleReviewSubmit = async (taskId, decision, feedback) => {
    try {
      await api.reviewTask(taskId, decision, feedback);
      refreshAllData();
    } catch (err) {
      alert(err.message || 'Review action failed');
    }
  };

  const handleInspectProject = (project) => {
    setInspectingProject(project);
    setIsInspectModalOpen(true);
  };

  // Profile management handlers
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        designation: user.designation || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'profile') {
      api.getMe().then((me) => {
        if (me && onUpdateUser) onUpdateUser(me);
      }).catch(() => {});
    }
  }, [activeTab]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setProfileError('First name and last name are required.');
      return;
    }
    setSavingProfile(true);
    setProfileNotice('');
    setProfileError('');
    try {
      const updated = await api.updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        designation: profileForm.designation.trim(),
      });
      if (onUpdateUser) onUpdateUser(updated);
      setProfileNotice('Profile information updated successfully!');
      setTimeout(() => setProfileNotice(''), 3500);
      setProfileTab('overview');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      setProfileError('Current password is required.');
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setProfileError('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setProfileError('New passwords do not match.');
      return;
    }
    setSavingProfile(true);
    setProfileNotice('');
    setProfileError('');
    try {
      await api.updateProfile({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setProfileNotice('Password updated successfully!');
      setTimeout(() => setProfileNotice(''), 3500);
      setProfileTab('overview');
    } catch (err) {
      setProfileError(err.message || 'Failed to update password');
    } finally {
      setSavingProfile(false);
    }
  };

  // Filter tasks for general task view
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.assignedToName && t.assignedToName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const userInitials =
    user && user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : 'U';

  const columns = [
    { id: 'not-started', title: 'Not Started', color: 'badge-todo' },
    { id: 'in-progress', title: 'In Progress', color: 'badge-progress' },
    { id: 'submitted', title: 'Pending Review', color: 'badge-review' },
    { id: 'completed', title: 'Completed', color: 'badge-completed' },
  ];

  return (
    <div className="dashboard-container">
      {/* Top Navbar */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-badge">
            <SparklesIcon size={20} className="text-accent" />
            <span className="logo-title">TaskFlow</span>
          </div>

          <nav className="nav-tabs">
            {canViewSummary && (
              <button
                type="button"
                className={`nav-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                <TrendingUpIcon size={16} />
                <span>Executive Summary</span>
              </button>
            )}

            {canManageProjects && (
              <button
                type="button"
                className={`nav-tab-btn ${activeTab === 'director_view' ? 'active' : ''}`}
                onClick={() => setActiveTab('director_view')}
              >
                <LayersIcon size={16} />
                <span>Project Milestones</span>
              </button>
            )}

            {canManageTeams && (
              <button
                type="button"
                className={`nav-tab-btn ${activeTab === 'manager_view' ? 'active' : ''}`}
                onClick={() => setActiveTab('manager_view')}
              >
                <UsersIcon size={16} />
                <span>Team Work & Subtasks</span>
              </button>
            )}

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'employee_view' ? 'active' : ''}`}
              onClick={() => setActiveTab('employee_view')}
            >
              <CheckCircleIcon size={16} />
              <span>My Assigned Work</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'all_tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('all_tasks')}
            >
              <LayersIcon size={16} />
              <span>Task Board</span>
            </button>


            {canManageEmployees && (
              <button
                type="button"
                className={`nav-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <UsersIcon size={16} />
                <span>Employees & Invites</span>
              </button>
            )}

            {canManageStructure && (
              <button
                type="button"
                className={`nav-tab-btn ${activeTab === 'org_structure' ? 'active' : ''}`}
                onClick={() => setActiveTab('org_structure')}
              >
                <ShieldIcon size={16} />
                <span>Structure, Roles & RBAC</span>
              </button>
            )}

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <BriefcaseIcon size={16} />
              <span>Profile</span>
            </button>
          </nav>
        </div>

        {/* Right side: Authenticated User Info, Theme Toggle, Log Out (No Role Switcher) */}
        <div className="header-right">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          <div className="user-profile-capsule">
            <div className="avatar-circle">{userInitials}</div>
            <div className="user-meta">
              <span className="user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="user-subtags">
                <span className="subtag-pill">
                  <BuildingIcon size={12} /> {user?.companyName}
                </span>
                <span className="subtag-pill role-subtag">
                  {user?.role?.toUpperCase()}
                </span>
                {user?.team && (
                  <span className="subtag-pill team-subtag">
                    {user.team}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm logout-btn"
            onClick={onLogout}
            title="Log out"
          >
            <LogOutIcon size={16} />
            <span className="hide-on-mobile">Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* 1. Head of Office / Admin Summary View */}
        {activeTab === 'summary' && (
          <AdminSummaryView
            projects={projects}
            loading={loading}
            onOpenNewProject={() => {
              setEditingProject(null);
              setIsProjectModalOpen(true);
            }}
            onInspectProject={handleInspectProject}
          />
        )}

        {/* 2. Project Director View */}
        {activeTab === 'director_view' && (
          <ProjectDirectorView
            projects={projects}
            tasks={tasks}
            onOpenNewTask={(projId, parentId) => handleOpenNewTask(projId, parentId)}
            onOpenReview={(task) => {
              setReviewingTask(task);
              setIsReviewModalOpen(true);
            }}
            onInspectProject={handleInspectProject}
          />
        )}

        {/* 3. Manager Team View */}
        {activeTab === 'manager_view' && (
          <ManagerTeamView
            tasks={tasks}
            projects={projects}
            employees={employees}
            onOpenNewTask={(projId, parentId) => handleOpenNewTask(projId, parentId)}
            onOpenReview={(task) => {
              setReviewingTask(task);
              setIsReviewModalOpen(true);
            }}
          />
        )}

        {/* 4. Junior / Employee My Work View */}
        {activeTab === 'employee_view' && (
          <EmployeeWorkView
            tasks={tasks}
            onUpdateProgress={handleUpdateProgress}
            onOpenSubmitModal={(task) => {
              setSubmittingTask(task);
              setIsSubmitModalOpen(true);
            }}
          />
        )}


        {/* 6. Admin Panel (Employee invitations, custom departments & roles) */}
        {activeTab === 'admin' && (
          <AdminEmployeePanel
            companyName={user?.companyName}
            onTestAcceptInvite={onTestAcceptInvite}
          />
        )}

        {/* 6.1 Organization Structure & Custom Permissions Builder */}
        {activeTab === 'org_structure' && (
          <OrganizationStructureBuilder
            employees={employees}
            onHierarchyUpdated={refreshAllData}
          />
        )}

        {/* 7. Detailed Kanban / List Tasks View */}
        {activeTab === 'all_tasks' && (
          <div className="all-tasks-section animate-fade-in">
            {/* Control & Filter Bar */}
            <div className="control-bar">
              <div className="search-input-wrapper">
                <SearchIcon size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search tasks, descriptions, or assignees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-controls">
                <div className="select-wrapper">
                  <label htmlFor="pFilter">Priority:</label>
                  <select
                    id="pFilter"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="view-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                    onClick={() => setViewMode('kanban')}
                  >
                    Kanban
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                  >
                    List
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenNewTask()}
                >
                  <PlusIcon size={18} />
                  <span>New Task</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading office tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="empty-state animate-fade-in">
                <SparklesIcon size={40} className="empty-icon text-accent" />
                <h3>No tasks found</h3>
                <p>Create your first task or subtask to organize work across the organization.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenNewTask()}
                  style={{ marginTop: '10px' }}
                >
                  <PlusIcon size={18} /> New Task
                </button>
              </div>
            ) : viewMode === 'kanban' ? (
              <div className="kanban-board">
                {columns.map((col) => {
                  const colTasks = filteredTasks.filter((t) => (t.status || 'not-started') === col.id);
                  return (
                    <div key={col.id} className="kanban-column">
                      <div className="column-header">
                        <div className="col-title-wrap">
                          <span className={`col-indicator ${col.color}`}></span>
                          <h4>{col.title}</h4>
                        </div>
                        <span className="col-count">{colTasks.length}</span>
                      </div>

                      <div className="column-body">
                        {colTasks.map((t) => (
                          <div key={t._id || t.id} className="task-card animate-scale-up">
                            <div className="task-card-top">
                              <span className={`priority-tag priority-${t.priority || 'medium'}`}>
                                {t.priority || 'medium'} · {t.weight || 1}x
                              </span>
                              <div className="task-actions">
                                <button
                                  type="button"
                                  className="action-icon-btn danger"
                                  onClick={() => handleDeleteTask(t._id || t.id)}
                                  title="Delete task"
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </div>
                            </div>

                            <strong className="task-title">{t.title}</strong>
                            {t.description && <p className="task-desc">{t.description}</p>}
                            {t.blocker && (
                              <div className="blocker-warning-tag">
                                <AlertTriangleIcon size={12} /> {t.blocker}
                              </div>
                            )}

                            <div className="task-footer">
                              <span className="task-meta assignee">
                                <UserIcon size={12} />
                                {t.assignedToName || 'Unassigned'}
                              </span>
                              <span className="task-meta">
                                <CalendarIcon size={12} />
                                {t.deadline || t.dueDate || 'Flexible'}
                              </span>
                            </div>

                            <div className="status-quick-change">
                              <span>Status:</span>
                              <select
                                value={t.status || 'not-started'}
                                onChange={(e) => handleUpdateProgress(t._id || t.id, { status: e.target.value })}
                              >
                                <option value="not-started">Not Started</option>
                                <option value="in-progress">In Progress</option>
                                <option value="submitted">Submitted</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Assigned To</th>
                      <th>Priority</th>
                      <th>Weight</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => (
                      <tr key={t._id || t.id}>
                        <td>
                          <strong>{t.title}</strong>
                          {t.blocker && (
                            <span className="blocker-warning-tag">
                              <AlertTriangleIcon size={12} /> {t.blocker}
                            </span>
                          )}
                        </td>
                        <td>{t.assignedToName || 'Unassigned'}</td>
                        <td>
                          <span className={`priority-tag priority-${t.priority || 'medium'}`}>
                            {t.priority || 'medium'}
                          </span>
                        </td>
                        <td>{t.weight || 1}x</td>
                        <td>{t.deadline || t.dueDate || 'Flexible'}</td>
                        <td>
                          <select
                            className="table-status-select"
                            value={t.status || 'not-started'}
                            onChange={(e) => handleUpdateProgress(t._id || t.id, { status: e.target.value })}
                          >
                            <option value="not-started">Not Started</option>
                            <option value="in-progress">In Progress</option>
                            <option value="submitted">Submitted</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="action-icon-btn danger"
                            onClick={() => handleDeleteTask(t._id || t.id)}
                            title="Delete task"
                          >
                            <TrashIcon size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 8. Profile View */}
        {activeTab === 'profile' && (
          <div className="profile-container animate-fade-in">
            <div className="profile-card">
              <div className="profile-header-banner">
                <div className="profile-avatar-lg">{userInitials}</div>
              </div>
              <div className="profile-body">
                <div className="profile-body-top">
                  <div>
                    <h2>
                      {user?.firstName} {user?.lastName}
                    </h2>
                    <p className="profile-mail">{user?.email}</p>
                  </div>
                  <div className="profile-role-badge">
                    <span className="role-chip">
                      <ShieldIcon size={13} /> {user?.positionTitle || userRole.toUpperCase()}
                    </span>
                    <span className="tier-chip">
                      Tier {user?.hierarchyLevel || (isAdmin ? 1 : 4)}
                    </span>
                  </div>
                </div>

                {/* Profile Subtabs */}
                <div className="profile-subtabs-bar">
                  <button
                    type="button"
                    className={`profile-subtab-btn ${profileTab === 'overview' ? 'active' : ''}`}
                    onClick={() => {
                      setProfileTab('overview');
                      setProfileNotice('');
                      setProfileError('');
                    }}
                  >
                    Account Overview
                  </button>
                  <button
                    type="button"
                    className={`profile-subtab-btn ${profileTab === 'edit' ? 'active' : ''}`}
                    onClick={() => {
                      setProfileTab('edit');
                      setProfileNotice('');
                      setProfileError('');
                      setProfileForm({
                        firstName: user?.firstName || '',
                        lastName: user?.lastName || '',
                        designation: user?.designation || '',
                      });
                    }}
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    className={`profile-subtab-btn ${profileTab === 'security' ? 'active' : ''}`}
                    onClick={() => {
                      setProfileTab('security');
                      setProfileNotice('');
                      setProfileError('');
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }}
                  >
                    Security & Password
                  </button>
                </div>

                {profileNotice && (
                  <div className="alert-box alert-success animate-fade-in" style={{ margin: '14px 0' }}>
                    <CheckCircleIcon size={16} />
                    <span>{profileNotice}</span>
                  </div>
                )}
                {profileError && (
                  <div className="alert-box alert-danger animate-fade-in" style={{ margin: '14px 0' }}>
                    <AlertTriangleIcon size={16} />
                    <span>{profileError}</span>
                  </div>
                )}

                {/* Subtab 1: Account Overview */}
                {profileTab === 'overview' && (
                  <div className="profile-info-grid">
                    <div className="info-box">
                      <span className="info-label">Company Workspace</span>
                      <span className="info-val">
                        <BuildingIcon size={15} className="text-accent" /> {user?.companyName || 'Workspace'}
                      </span>
                    </div>
                    <div className="info-box">
                      <span className="info-label">Authority Tier & Role</span>
                      <span className="info-val">
                        <ShieldIcon size={15} className="text-accent" /> Tier {user?.hierarchyLevel || (isAdmin ? 1 : 4)} • {user?.positionTitle || userRole.toUpperCase()}
                      </span>
                    </div>
                    <div className="info-box">
                      <span className="info-label">Department</span>
                      <span className="info-val">{user?.department || 'Leadership & Administration'}</span>
                    </div>
                    <div className="info-box">
                      <span className="info-label">Team / Squad</span>
                      <span className="info-val">
                        <UsersIcon size={15} className="text-accent" /> {user?.team || 'General (No squad assigned)'}
                      </span>
                    </div>
                    <div className="info-box">
                      <span className="info-label">Job Title / Designation</span>
                      <span className="info-val">{user?.designation || 'Staff Member'}</span>
                    </div>
                    <div className="info-box">
                      <span className="info-label">Account Status</span>
                      <span className="info-val status-badge-active">
                        <CheckCircleIcon size={14} /> Active & Verified
                      </span>
                    </div>
                    <div className="info-box" style={{ gridColumn: '1 / -1' }}>
                      <span className="info-label">Data Access Scope (RBAC)</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <span className="scope-badge">Task Scope: {(user?.accessScopes?.taskScope || (isAdmin ? 'company' : 'own')).toUpperCase()}</span>
                        <span className="scope-badge">Project Scope: {(user?.accessScopes?.projectScope || 'project').toUpperCase()}</span>
                        <span className="scope-badge">Employee Scope: {(user?.accessScopes?.employeeScope || (isAdmin ? 'company' : 'own')).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Edit Profile Form */}
                {profileTab === 'edit' && (
                  <form onSubmit={handleSaveProfile} className="profile-edit-form">
                    <div className="form-row-2">
                      <div className="form-group">
                        <label className="form-label">First Name *</label>
                        <input
                          type="text"
                          className="input-field"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Last Name *</label>
                        <input
                          type="text"
                          className="input-field"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Designation / Professional Title</label>
                      <input
                        type="text"
                        className="input-field"
                        value={profileForm.designation}
                        onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                        placeholder="e.g. Lead Engineer, Project Director"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Address (Managed by Admin)</label>
                      <input
                        type="email"
                        className="input-field"
                        value={user?.email || ''}
                        disabled
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                        To change your workspace email address, please contact your workspace administrator.
                      </small>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setProfileTab('overview')}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                        {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Subtab 3: Change Password Form */}
                {profileTab === 'security' && (
                  <form onSubmit={handleChangePassword} className="profile-edit-form">
                    <div className="form-group">
                      <label className="form-label">Current Password *</label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="Enter current password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label className="form-label">New Password * (min 6 characters)</label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="Enter new password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          minLength={6}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Confirm New Password *</label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="Re-enter new password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          minLength={6}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setProfileTab('overview')}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                        {savingProfile ? 'Updating Password...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        editingProject={editingProject}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        editingTask={editingTask}
        projects={projects}
        employees={employees}
        defaultProjectId={taskModalProjectId}
        parentTaskId={taskModalParentId}
      />

      <TaskReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingTask(null);
        }}
        task={reviewingTask}
        onReviewSubmit={handleReviewSubmit}
      />

      <SubmitWorkModal
        isOpen={isSubmitModalOpen}
        onClose={() => {
          setIsSubmitModalOpen(false);
          setSubmittingTask(null);
        }}
        task={submittingTask}
        onSubmitWork={handleSubmitWork}
      />

      <ProjectInspectModal
        isOpen={isInspectModalOpen}
        onClose={() => {
          setIsInspectModalOpen(false);
          setInspectingProject(null);
        }}
        project={inspectingProject}
        tasks={tasks}
      />
    </div>
  );
};
