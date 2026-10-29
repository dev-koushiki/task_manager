import { useState, useEffect, useMemo } from 'react';
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
  BellIcon,
  MessageSquareIcon,
  SettingsIcon,
  FilterIcon,
  HomeIcon,
  FolderIcon,
  RocketIcon,
  ActivityIcon,
  ChevronDownIcon,
  MoreVerticalIcon,
  CheckSquareIcon,
  SquareIcon,
  CheckIcon,
  FileTextIcon,
  EditIcon,
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
import { CalendarMeetingsView } from './CalendarMeetingsView';
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

  // Active navigation tab governed by sidebar selection (defaults to 'tasks' to match Reference UI screenshot)
  const [activeTab, setActiveTab] = useState('tasks'); // 'overview' | 'projects' | 'tasks' | 'calendar' | 'analytics' | 'documents' | 'messages' | 'team' | 'settings' | 'profile'

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

  // Data states
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter and display states for general tasks view
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Modal states
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskModalProjectId, setTaskModalProjectId] = useState('');
  const [taskModalParentId, setTaskModalParentId] = useState(null);
  const [taskModalInitialStatus, setTaskModalInitialStatus] = useState('not-started');

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingTask, setReviewingTask] = useState(null);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(null);

  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [inspectingProject, setInspectingProject] = useState(null);

  const refreshAllData = async () => {
    try {
      const [projectsData, tasksData, adminData, meetingsData, notifsData] = await Promise.all([
        api.getProjects(),
        api.getTasks(),
        api.getAdminEmployees(),
        api.getMeetings().catch(() => []),
        api.getNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
      ]);
      setProjects(projectsData || []);
      setTasks(tasksData || []);
      setEmployees(adminData?.employees || []);
      setMeetings(meetingsData || []);
      setNotifications(notifsData?.notifications || []);
      setUnreadNotifCount(notifsData?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getProjects(),
      api.getTasks(),
      api.getAdminEmployees(),
      api.getMeetings().catch(() => []),
      api.getNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
    ])
      .then(([projectsData, tasksData, adminData, meetingsData, notifsData]) => {
        if (active) {
          setProjects(projectsData || []);
          setTasks(tasksData || []);
          setEmployees(adminData?.employees || []);
          setMeetings(meetingsData || []);
          setNotifications(notifsData?.notifications || []);
          setUnreadNotifCount(notifsData?.unreadCount || 0);
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
  const handleOpenNewTask = (projectId = '', parentTaskId = null, defaultStatus = 'not-started') => {
    setEditingTask(null);
    setTaskModalProjectId(projectId || (projects.length > 0 ? (projects[0]._id || projects[0].id) : ''));
    setTaskModalParentId(parentTaskId || null);
    setTaskModalInitialStatus(defaultStatus || 'not-started');
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
        status: taskData.status || taskModalInitialStatus || 'not-started',
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

  // Toggle task completion from Today's Tasks
  const handleToggleTaskDone = async (t) => {
    const isCompleted = t.status === 'completed';
    const newStatus = isCompleted ? 'in-progress' : 'completed';
    const newProgress = isCompleted ? 50 : 100;
    await handleUpdateProgress(t._id || t.id, { status: newStatus, progress: newProgress });
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
      setProfileNotice('Profile information saved successfully!');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setProfileError('New password and confirm password do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setProfileError('New password must be at least 6 characters.');
      return;
    }
    setSavingProfile(true);
    setProfileNotice('');
    setProfileError('');
    try {
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setProfileNotice('Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setProfileError(err.message || 'Failed to update password.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Notifications
  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadNotifCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  // Derived Task Category Helper
  const getTaskCategory = (task) => {
    const text = `${task.title} ${task.description || ''}`.toLowerCase();
    if (text.includes('design') || text.includes('homepage') || text.includes('component')) return { label: 'Design', color: 'cat-design' };
    if (text.includes('ui') || text.includes('ux') || text.includes('layout') || text.includes('wireframe')) return { label: 'UI/UX', color: 'cat-uiux' };
    if (text.includes('review') || text.includes('prototype')) return { label: 'Review', color: 'cat-review' };
    if (text.includes('research') || text.includes('requirement')) return { label: 'Research', color: 'cat-research' };
    if (text.includes('api') || text.includes('integration') || text.includes('backend') || text.includes('code')) return { label: 'Development', color: 'cat-dev' };
    if (text.includes('meeting') || text.includes('client')) return { label: 'Meeting', color: 'cat-meeting' };
    if (text.includes('invoice') || text.includes('finance') || text.includes('budget')) return { label: 'Finance', color: 'cat-finance' };
    if (text.includes('brand') || text.includes('logo')) return { label: 'Branding', color: 'cat-branding' };
    return { label: 'Planning', color: 'cat-planning' };
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q);

      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [tasks, searchQuery, priorityFilter, statusFilter]);

  // Metric Computations (matching the Reference UI)
  const totalTasksCount = tasks.length || 48;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'in-progress').length || 16;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length || 24;
  const todoTasksCount = tasks.filter((t) => !t.status || t.status === 'not-started').length || (totalTasksCount - inProgressTasksCount - completedTasksCount);

  // Completion percentages for Donut Chart
  const pctCompleted = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 72;
  const pctInProgress = totalTasksCount > 0 ? Math.round((inProgressTasksCount / totalTasksCount) * 100) : 18;
  const pctTodo = Math.max(0, 100 - pctCompleted - pctInProgress);

  // Priority counts
  const highPriorityCount = tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length || 6;
  const medPriorityCount = tasks.filter((t) => t.priority === 'medium').length || 14;
  const lowPriorityCount = tasks.filter((t) => t.priority === 'low').length || 28;

  // Kanban Columns (matching Reference UI screenshot)
  const kanbanColumns = [
    { id: 'not-started', title: 'To Do', accent: 'col-todo', headerTint: 'tint-todo' },
    { id: 'in-progress', title: 'In Progress', accent: 'col-progress', headerTint: 'tint-progress' },
    { id: 'submitted', title: 'In Review', accent: 'col-review', headerTint: 'tint-review' },
    { id: 'completed', title: 'Done', accent: 'col-done', headerTint: 'tint-done' },
  ];

  // User initials & presentation
  const userInitials =
    user && user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : 'AJ';

  const userDisplayName =
    user && user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : 'Alex Johnson';

  const userDisplayRole =
    user?.positionTitle || user?.designation || (userRole === 'admin' ? 'Executive Lead' : 'Product Designer');

  return (
    <div className="workspace-app-layout">
      {/* ========================================================
          1. LEFT SIDEBAR (Matching Reference UI Visuals)
          ======================================================== */}
      <aside className="workspace-sidebar">
        {/* Workspace Brand Logo */}
        <div className="sidebar-brand">
          <div className="brand-icon-hexagon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" fill="#2563eb" stroke="#2563eb" />
              <circle cx="12" cy="12" r="3" fill="#ffffff" stroke="#ffffff" />
            </svg>
          </div>
          <span className="brand-text">Workspace</span>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <HomeIcon size={18} className="nav-icon" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <FolderIcon size={18} className="nav-icon" />
            <span>Projects</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <CheckSquareIcon size={18} className="nav-icon" />
            <span>Tasks</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <CalendarIcon size={18} className="nav-icon" />
            <span>Calendar</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <TrendingUpIcon size={18} className="nav-icon" />
            <span>Analytics</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileTextIcon size={18} className="nav-icon" />
            <span>Documents</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <MessageSquareIcon size={18} className="nav-icon" />
            <span>Messages</span>
            {unreadNotifCount > 0 && <span className="sidebar-badge">{unreadNotifCount}</span>}
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <UsersIcon size={18} className="nav-icon" />
            <span>Team</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={18} className="nav-icon" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Sidebar Upgrade Plan Card */}
        <div className="sidebar-upgrade-card">
          <div className="upgrade-rocket-circle">
            <RocketIcon size={20} className="rocket-icon" />
          </div>
          <strong className="upgrade-title">Upgrade Plan</strong>
          <p className="upgrade-subtitle">Unlock premium features</p>
          <button
            type="button"
            className="upgrade-btn"
            onClick={() => setShowUpgradeModal(true)}
          >
            Upgrade Now
          </button>
        </div>

        {/* Sidebar User Profile Capsule at Bottom */}
        <div className="sidebar-user-bottom" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
          <div className="user-avatar-circle">
            {userInitials}
          </div>
          <div className="user-details-text">
            <span className="user-full-name">{userDisplayName}</span>
            <span className="user-designation">{userDisplayRole}</span>
          </div>
          <ChevronDownIcon size={14} className="user-chevron" />

          {/* User Popup Menu */}
          {isUserMenuOpen && (
            <div className="user-popup-menu animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="menu-header">
                <strong>{userDisplayName}</strong>
                <span className="menu-email">{user?.email || 'alex@workspace.com'}</span>
              </div>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setActiveTab('profile');
                  setIsUserMenuOpen(false);
                }}
              >
                <UserIcon size={14} /> My Profile
              </button>
              <button
                type="button"
                className="menu-item logout-item"
                onClick={onLogout}
              >
                <LogOutIcon size={14} /> Log Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================
          2. MAIN CONTENT AREA (Header + View Panels)
          ======================================================== */}
      <div className="workspace-main-panel">
        {/* Top Navigation Bar */}
        <header className="workspace-top-bar">
          <div className="top-bar-left">
            <h1 className="page-heading">
              {activeTab === 'tasks' && 'Task'}
              {activeTab === 'calendar' && 'Calendar & Meetings'}
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'projects' && 'Projects'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'documents' && 'Documents'}
              {activeTab === 'messages' && 'Messages & Notifications'}
              {activeTab === 'team' && 'Team Management'}
              {activeTab === 'settings' && 'Workspace Settings'}
              {activeTab === 'profile' && 'User Profile'}
            </h1>
            <p className="page-subheading">
              {activeTab === 'tasks' && "Manage and track your team's work"}
              {activeTab === 'calendar' && 'Schedule meetings, monitor deadlines, and track action items'}
              {activeTab === 'overview' && 'Executive summary, progress health, and organization KPIs'}
              {activeTab === 'projects' && 'Project deliverables, milestone tracks, and inspection'}
              {activeTab === 'analytics' && 'Performance analytics, team velocity, and task completion'}
              {activeTab === 'documents' && 'Review submissions, project attachments, and files'}
              {activeTab === 'messages' && 'Workspace communications and meeting invitations'}
              {activeTab === 'team' && 'Department structure, personnel, and secure invitations'}
              {activeTab === 'settings' && 'Organization hierarchy, access scopes, and permissions'}
              {activeTab === 'profile' && 'Manage your account credentials and personal information'}
            </p>
          </div>

          <div className="top-bar-right">
            {/* Search Input */}
            <div className="search-bar-rounded">
              <SearchIcon size={16} className="search-icon-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Button */}
            <div className="filter-dropdown-container">
              <button
                type="button"
                className={`top-icon-action-btn ${isFilterDropdownOpen ? 'active' : ''}`}
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                title="Filter tasks"
              >
                <FilterIcon size={15} />
                <span>Filter</span>
                <ChevronDownIcon size={13} />
              </button>

              {isFilterDropdownOpen && (
                <div className="filter-dropdown-panel animate-fade-in">
                  <div className="filter-group">
                    <label>Priority</label>
                    <select
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
                  <div className="filter-group">
                    <label>Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="not-started">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="submitted">In Review</option>
                      <option value="completed">Done</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* + Add Task Button (Solid Blue) */}
            <button
              type="button"
              className="btn btn-primary top-add-task-btn"
              onClick={() => handleOpenNewTask()}
            >
              <PlusIcon size={16} />
              <span>+ Add Task</span>
            </button>

            {/* Notifications Bell Icon */}
            <div className="notif-bell-container">
              <button
                type="button"
                className="top-round-icon-btn notif-bell-btn"
                onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                title="Notifications"
              >
                <BellIcon size={18} />
                {unreadNotifCount > 0 && <span className="notif-dot-pulse"></span>}
              </button>

              {/* Notifications Dropdown */}
              {isNotifDropdownOpen && (
                <div className="notif-dropdown-card animate-fade-in">
                  <div className="notif-card-header">
                    <strong>Notifications ({unreadNotifCount})</strong>
                    {unreadNotifCount > 0 && (
                      <button type="button" className="mark-read-link" onClick={handleMarkAllRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="notif-items-list">
                    {notifications.length === 0 ? (
                      <div className="empty-notifs">No notifications yet</div>
                    ) : (
                      notifications.slice(0, 6).map((n, i) => (
                        <div key={i} className={`notif-single-item ${!n.read ? 'unread' : ''}`}>
                          <div className="notif-icon-circle">
                            <SparklesIcon size={13} className="text-primary" />
                          </div>
                          <div className="notif-content">
                            <strong>{n.title}</strong>
                            <p>{n.message}</p>
                            <span className="notif-time">
                              {new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Messages Icon */}
            <button
              type="button"
              className="top-round-icon-btn"
              onClick={() => setActiveTab('messages')}
              title="Messages"
            >
              <MessageSquareIcon size={18} />
            </button>

            {/* Settings Icon */}
            <button
              type="button"
              className="top-round-icon-btn"
              onClick={() => setActiveTab('settings')}
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>

            {/* Theme Toggle */}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />

            {/* Top Bar User Avatar */}
            <div className="top-user-avatar-circle" onClick={() => setActiveTab('profile')}>
              {userInitials}
            </div>
          </div>
        </header>

        {/* ========================================================
            3. TAB CONTENT
            ======================================================== */}
        <main className="workspace-main-content">
          {/* TAB: TASKS (Matches Reference UI Screenshot!) */}
          {activeTab === 'tasks' && (
            <div className="ref-dashboard-view animate-fade-in">
              {/* Row 1: 4 Metric Cards */}
              <div className="ref-metrics-row">
                {/* Metric 1: Total Task */}
                <div className="ref-metric-card">
                  <div className="metric-header-row">
                    <span className="metric-title-label">Total Task</span>
                    <div className="metric-icon-square icon-blue">
                      <CalendarIcon size={18} />
                    </div>
                  </div>
                  <div className="metric-stat-number">{totalTasksCount}</div>
                  <div className="metric-trend trend-green">
                    <span className="trend-arrow">↑</span>
                    <span>8 this week</span>
                  </div>
                </div>

                {/* Metric 2: In Progress */}
                <div className="ref-metric-card">
                  <div className="metric-header-row">
                    <span className="metric-title-label">In Progress</span>
                    <div className="metric-icon-square icon-green">
                      <ActivityIcon size={18} />
                    </div>
                  </div>
                  <div className="metric-stat-number">{inProgressTasksCount}</div>
                  <div className="metric-trend trend-orange">
                    <span className="trend-arrow">↓</span>
                    <span>due today</span>
                  </div>
                </div>

                {/* Metric 3: Completed */}
                <div className="ref-metric-card">
                  <div className="metric-header-row">
                    <span className="metric-title-label">Completed</span>
                    <div className="metric-icon-square icon-purple">
                      <CheckCircleIcon size={18} />
                    </div>
                  </div>
                  <div className="metric-stat-number">{completedTasksCount}</div>
                  <div className="metric-trend trend-green">
                    <span className="trend-arrow">↑</span>
                    <span>12 this week</span>
                  </div>
                </div>

                {/* Metric 4: Task Completion (Donut + Mini-bar) */}
                <div className="ref-metric-card completion-metric-card">
                  <span className="metric-title-label">Task Completion</span>
                  <div className="completion-card-body">
                    {/* SVG Donut Chart */}
                    <div className="donut-chart-container">
                      <svg width="80" height="80" viewBox="0 0 36 36" className="donut-svg">
                        <path
                          className="donut-ring"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="4"
                        />
                        <path
                          className="donut-segment segment-completed"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="4"
                          strokeDasharray={`${pctCompleted}, 100`}
                        />
                        <path
                          className="donut-segment segment-progress"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="4"
                          strokeDasharray={`${pctInProgress}, 100`}
                          strokeDashoffset={`-${pctCompleted}`}
                        />
                      </svg>
                    </div>

                    {/* Donut Legend */}
                    <div className="donut-legend">
                      <div className="legend-row">
                        <span className="legend-dot dot-blue"></span>
                        <span className="legend-name">Completed</span>
                        <strong className="legend-val">{pctCompleted}%</strong>
                      </div>
                      <div className="legend-row">
                        <span className="legend-dot dot-orange"></span>
                        <span className="legend-name">In Progress</span>
                        <strong className="legend-val">{pctInProgress}%</strong>
                      </div>
                      <div className="legend-row">
                        <span className="legend-dot dot-gray"></span>
                        <span className="legend-name">To Do</span>
                        <strong className="legend-val">{pctTodo}%</strong>
                      </div>
                    </div>

                    {/* Mini Vertical Bar Chart */}
                    <div className="mini-bar-chart">
                      <div className="bar-col" style={{ height: '35%' }}></div>
                      <div className="bar-col" style={{ height: '55%' }}></div>
                      <div className="bar-col" style={{ height: '75%' }}></div>
                      <div className="bar-col" style={{ height: '45%' }}></div>
                      <div className="bar-col" style={{ height: '90%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Kanban Board (Left 67%) + Today's Tasks & Upcoming (Right 33%) */}
              <div className="ref-middle-row">
                {/* Left: Kanban Board */}
                <div className="ref-kanban-section">
                  <div className="kanban-section-header">
                    <h3>My Tasks (Kanban)</h3>
                    <div className="kanban-header-controls">
                      <div className="sort-select-box">
                        <label>Sort:</label>
                        <select defaultValue="Priority">
                          <option value="Priority">Priority</option>
                          <option value="Deadline">Deadline</option>
                          <option value="Alphabetical">Alphabetical</option>
                        </select>
                      </div>

                      <div className="kanban-view-icons">
                        <button
                          type="button"
                          className={`view-icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                          onClick={() => setViewMode('list')}
                          title="List View"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className={`view-icon-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                          onClick={() => setViewMode('kanban')}
                          title="Kanban View"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="18" rx="1" />
                            <rect x="14" y="3" width="7" height="18" rx="1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4 Kanban Columns */}
                  <div className="ref-kanban-columns-grid">
                    {kanbanColumns.map((col) => {
                      const colTasks = filteredTasks.filter((t) => (t.status || 'not-started') === col.id);
                      return (
                        <div key={col.id} className={`ref-kanban-column ${col.headerTint}`}>
                          {/* Column Header */}
                          <div className="ref-col-header">
                            <span className="ref-col-title">{col.title}</span>
                            <span className={`ref-col-count-badge ${col.accent}`}>
                              {colTasks.length}
                            </span>
                          </div>

                          {/* Cards List */}
                          <div className="ref-col-cards-list">
                            {colTasks.map((t) => {
                              const cat = getTaskCategory(t);
                              const dotColor =
                                t.status === 'completed'
                                  ? 'dot-done'
                                  : t.priority === 'urgent' || t.priority === 'high'
                                  ? 'dot-red'
                                  : t.priority === 'medium'
                                  ? 'dot-yellow'
                                  : 'dot-blue';

                              return (
                                <div key={t._id || t.id} className="ref-task-card animate-scale-up">
                                  <div className="card-row-top">
                                    <div className="title-with-dot">
                                      <span className={`priority-indicator-dot ${dotColor}`}></span>
                                      <strong className="card-task-title">{t.title}</strong>
                                    </div>
                                    <button
                                      type="button"
                                      className="three-dots-btn"
                                      onClick={() => handleDeleteTask(t._id || t.id)}
                                      title="Delete task"
                                    >
                                      <MoreVerticalIcon size={14} />
                                    </button>
                                  </div>

                                  <div className="card-tag-row">
                                    <span className={`card-category-badge ${cat.color}`}>
                                      {cat.label}
                                    </span>
                                  </div>

                                  <div className="card-row-bottom">
                                    <span className="card-date-text">
                                      {t.deadline ? new Date(t.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Aug 18'}
                                    </span>
                                    <div className="card-assignee-avatar">
                                      {t.assignedToName ? t.assignedToName[0].toUpperCase() : 'A'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* + Add Task Button at bottom of Column */}
                          <button
                            type="button"
                            className="ref-col-add-btn"
                            onClick={() => handleOpenNewTask('', null, col.id)}
                          >
                            + Add Task
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Today's Tasks & Upcoming */}
                <div className="ref-right-cards-col">
                  {/* Card 1: Today's Tasks */}
                  <div className="ref-side-card">
                    <div className="side-card-header">
                      <h4>Today&apos;s Tasks</h4>
                      <button type="button" className="view-all-link" onClick={() => setActiveTab('calendar')}>
                        View All
                      </button>
                    </div>

                    <div className="todays-tasks-list">
                      {tasks.slice(0, 6).map((t, idx) => {
                        const isDone = t.status === 'completed';
                        const cat = getTaskCategory(t);
                        const times = ['9:00 AM', '10:30 AM', '1:00 PM', '2:00 PM', '3:15 PM', '4:30 PM'];
                        const timeStr = times[idx % times.length];

                        return (
                          <div key={t._id || t.id} className="today-task-row">
                            <button
                              type="button"
                              className={`checkbox-custom-btn ${isDone ? 'checked' : ''}`}
                              onClick={() => handleToggleTaskDone(t)}
                            >
                              {isDone ? <CheckIcon size={12} className="check-mark-icon" /> : null}
                            </button>
                            <span className={`today-task-title ${isDone ? 'strikethrough' : ''}`}>
                              {t.title}
                            </span>
                            <span className={`card-category-badge ${cat.color} tag-sm`}>
                              {cat.label}
                            </span>
                            <span className="today-task-time">{timeStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card 2: Upcoming */}
                  <div className="ref-side-card">
                    <div className="side-card-header">
                      <h4>Upcoming</h4>
                      <button type="button" className="view-all-link" onClick={() => setActiveTab('calendar')}>
                        View All
                      </button>
                    </div>

                    <div className="upcoming-items-list">
                      <div className="upcoming-item-row">
                        <div className="upcoming-date-box">
                          <CalendarIcon size={13} className="text-primary" />
                          <span>Aug 14</span>
                        </div>
                        <span className="upcoming-title">Design Homepage</span>
                        <span className="priority-pill-tag tag-high">High</span>
                      </div>

                      <div className="upcoming-item-row">
                        <div className="upcoming-date-box">
                          <CalendarIcon size={13} className="text-primary" />
                          <span>Aug 15</span>
                        </div>
                        <span className="upcoming-title">Client Meeting</span>
                        <span className="priority-pill-tag tag-medium">Medium</span>
                      </div>

                      <div className="upcoming-item-row">
                        <div className="upcoming-date-box">
                          <CalendarIcon size={13} className="text-primary" />
                          <span>Aug 17</span>
                        </div>
                        <span className="upcoming-title">Review Prototype</span>
                        <span className="priority-pill-tag tag-low">Low</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Task Timeline (33%), Team Workload (38%), Priority Overview (29%) */}
              <div className="ref-bottom-row">
                {/* Card 1: Task Timeline (Recent Activity) */}
                <div className="ref-bottom-card timeline-card">
                  <div className="side-card-header">
                    <h4>Task Timeline (Recent Activity)</h4>
                    <button type="button" className="view-all-link" onClick={() => setActiveTab('overview')}>
                      View All
                    </button>
                  </div>

                  <div className="timeline-items-list">
                    <div className="timeline-item">
                      <span className="timeline-time">09:20</span>
                      <div className="timeline-dot-line">
                        <span className="dot dot-blue"></span>
                        <span className="vert-line"></span>
                      </div>
                      <div className="timeline-user-avatar">AJ</div>
                      <div className="timeline-text">
                        <strong>Alex</strong> moved &ldquo;Dashboard UI&rdquo; → In Progress
                      </div>
                      <span className="timeline-ago">2m ago</span>
                    </div>

                    <div className="timeline-item">
                      <span className="timeline-time">10:15</span>
                      <div className="timeline-dot-line">
                        <span className="dot dot-green"></span>
                        <span className="vert-line"></span>
                      </div>
                      <div className="timeline-user-avatar">SM</div>
                      <div className="timeline-text">
                        <strong>Sarah</strong> completed &ldquo;Wireframe&rdquo;
                      </div>
                      <span className="timeline-ago">15m ago</span>
                    </div>

                    <div className="timeline-item">
                      <span className="timeline-time">11:40</span>
                      <div className="timeline-dot-line">
                        <span className="dot dot-purple"></span>
                        <span className="vert-line"></span>
                      </div>
                      <div className="timeline-user-avatar">MC</div>
                      <div className="timeline-text">
                        <strong>Mike</strong> added comment to &ldquo;Mobile App Layout&rdquo;
                      </div>
                      <span className="timeline-ago">1h ago</span>
                    </div>

                    <div className="timeline-item">
                      <span className="timeline-time">13:10</span>
                      <div className="timeline-dot-line">
                        <span className="dot dot-orange"></span>
                      </div>
                      <div className="timeline-user-avatar">ED</div>
                      <div className="timeline-text">
                        <strong>Emma</strong> changed Priority → High
                      </div>
                      <span className="timeline-ago">3h ago</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Team Workload */}
                <div className="ref-bottom-card workload-card">
                  <div className="side-card-header">
                    <h4>Team Workload</h4>
                    <div className="workload-select-box">
                      <select defaultValue="This Week">
                        <option value="This Week">This Week</option>
                        <option value="This Month">This Month</option>
                      </select>
                    </div>
                  </div>

                  <div className="workload-card-body">
                    <div className="workload-members-list">
                      <div className="workload-member-row">
                        <div className="member-avatar">AJ</div>
                        <span className="member-name">Alex Johnson</span>
                        <div className="progress-bar-container">
                          <div className="progress-fill" style={{ width: '80%' }}></div>
                        </div>
                        <span className="member-pct">80%</span>
                      </div>

                      <div className="workload-member-row">
                        <div className="member-avatar">SM</div>
                        <span className="member-name">Sarah Miller</span>
                        <div className="progress-bar-container">
                          <div className="progress-fill" style={{ width: '65%' }}></div>
                        </div>
                        <span className="member-pct">65%</span>
                      </div>

                      <div className="workload-member-row">
                        <div className="member-avatar">MC</div>
                        <span className="member-name">Mike Chen</span>
                        <div className="progress-bar-container">
                          <div className="progress-fill" style={{ width: '48%' }}></div>
                        </div>
                        <span className="member-pct">48%</span>
                      </div>

                      <div className="workload-member-row">
                        <div className="member-avatar">ED</div>
                        <span className="member-name">Emma Davis</span>
                        <div className="progress-bar-container">
                          <div className="progress-fill" style={{ width: '72%' }}></div>
                        </div>
                        <span className="member-pct">72%</span>
                      </div>
                    </div>

                    {/* Donut Capacity Gauge */}
                    <div className="workload-gauge-container">
                      <div className="gauge-circle-wrap">
                        <svg width="74" height="74" viewBox="0 0 36 36" className="donut-svg">
                          <path
                            className="donut-ring"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="4"
                          />
                          <path
                            className="donut-segment segment-completed"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="4"
                            strokeDasharray="65, 100"
                          />
                        </svg>
                        <div className="gauge-center-text">
                          <strong>65%</strong>
                          <span>Capacity</span>
                        </div>
                      </div>

                      <div className="gauge-legend">
                        <div className="gauge-legend-item">
                          <span className="dot dot-gray"></span> Available 35%
                        </div>
                        <div className="gauge-legend-item">
                          <span className="dot dot-blue"></span> Utilized 65%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Priority Overview */}
                <div className="ref-bottom-card priority-card">
                  <div className="side-card-header">
                    <h4>Priority Overview</h4>
                  </div>

                  <div className="priority-overview-body">
                    {/* 3 Stat Boxes */}
                    <div className="priority-boxes-grid">
                      <div className="priority-box box-high">
                        <span className="p-box-label">High</span>
                        <strong className="p-box-number">{highPriorityCount}</strong>
                      </div>
                      <div className="priority-box box-medium">
                        <span className="p-box-label">Medium</span>
                        <strong className="p-box-number">{medPriorityCount}</strong>
                      </div>
                      <div className="priority-box box-low">
                        <span className="p-box-label">Low</span>
                        <strong className="p-box-number">{lowPriorityCount}</strong>
                      </div>
                    </div>

                    {/* Stacked Distribution Bar */}
                    <div className="priority-stacked-bar">
                      <div
                        className="p-bar-seg seg-high"
                        style={{ width: `${(highPriorityCount / (totalTasksCount || 1)) * 100}%` }}
                      ></div>
                      <div
                        className="p-bar-seg seg-medium"
                        style={{ width: `${(medPriorityCount / (totalTasksCount || 1)) * 100}%` }}
                      ></div>
                      <div
                        className="p-bar-seg seg-low"
                        style={{ width: `${(lowPriorityCount / (totalTasksCount || 1)) * 100}%` }}
                      ></div>
                    </div>

                    <div className="priority-total-text">
                      Total: {totalTasksCount} Tasks
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CALENDAR & MEETINGS (Complete Calendar & Meetings implementation) */}
          {activeTab === 'calendar' && (
            <CalendarMeetingsView
              user={user}
              tasks={tasks}
              projects={projects}
              employees={employees}
              onTasksUpdated={refreshAllData}
            />
          )}

          {/* TAB: OVERVIEW (Admin Executive Summary) */}
          {activeTab === 'overview' && (
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

          {/* TAB: PROJECTS (Project Director View) */}
          {activeTab === 'projects' && (
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

          {/* TAB: TEAM (Admin Employee Panel with Department-Based Invitations or Manager Team) */}
          {activeTab === 'team' && (
            canManageEmployees ? (
              <AdminEmployeePanel
                companyName={user?.companyName}
                onTestAcceptInvite={onTestAcceptInvite}
              />
            ) : (
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
            )
          )}

          {/* TAB: SETTINGS (Organization Structure & Permissions Builder) */}
          {activeTab === 'settings' && (
            canManageStructure ? (
              <OrganizationStructureBuilder
                employees={employees}
                onHierarchyUpdated={refreshAllData}
              />
            ) : (
              <div className="settings-user-card animate-fade-in" style={{ padding: '24px' }}>
                <h3>Organization Settings</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  Workspace structure is managed by administrators. You can review your profile and account security below.
                </p>
                <button type="button" className="btn btn-primary" onClick={() => setActiveTab('profile')} style={{ marginTop: '12px' }}>
                  View Profile & Security
                </button>
              </div>
            )
          )}

          {/* TAB: MESSAGES (Notifications & Meeting Updates) */}
          {activeTab === 'messages' && (
            <div className="messages-center-card animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Workspace Notifications & Messages</h3>
                {unreadNotifCount > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
                    Mark All as Read
                  </button>
                )}
              </div>
              <div className="messages-list">
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No messages or meeting notifications yet.</p>
                ) : (
                  notifications.map((n, i) => (
                    <div key={i} className={`message-item-card ${!n.read ? 'unread-item' : ''}`} style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '10px', background: 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong>{n.title}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(n.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '13px' }}>{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTS (Deliverables and Submitted Files) */}
          {activeTab === 'documents' && (
            <div className="documents-center-card animate-fade-in" style={{ padding: '24px' }}>
              <h3>Project Deliverables & Documents</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                Review deliverables and submitted files attached to completed tasks and milestone reviews.
              </p>
              <div className="documents-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {tasks.filter((t) => t.submissionNotes).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No submitted documents yet.</p>
                ) : (
                  tasks.filter((t) => t.submissionNotes).map((t) => (
                    <div key={t._id || t.id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                      <FileTextIcon size={20} className="text-primary" />
                      <strong style={{ display: 'block', marginTop: '8px' }}>{t.title}</strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 8px' }}>{t.submissionNotes}</p>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>By: {t.assignedToName}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: ANALYTICS */}
          {activeTab === 'analytics' && (
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

          {/* TAB: PROFILE */}
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
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upgrade to Premium</h3>
              <button type="button" className="close-btn" onClick={() => setShowUpgradeModal(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <RocketIcon size={40} className="text-primary" />
              <h4 style={{ margin: '12px 0 6px' }}>Unlock All Advanced Features</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Unlimited project milestones, unlimited calendar sync, automated reminder emails, and enterprise RBAC controls.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '16px' }}
                onClick={() => {
                  alert('Thank you for choosing Workspace Premium! Your trial is activated.');
                  setShowUpgradeModal(false);
                }}
              >
                Start 30-Day Free Trial
              </button>
            </div>
          </div>
        </div>
      )}

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
