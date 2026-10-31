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
  ActivityIcon,
  ChevronDownIcon,
  MoreVerticalIcon,
  CheckSquareIcon,
  SquareIcon,
  CheckIcon,
  FileTextIcon,
  EditIcon,
  GitBranchIcon,
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
import { OrgTreeManagement } from './OrgTreeManagement';
import { UnifiedEmployeeDashboard } from './UnifiedEmployeeDashboard';
import { EmployeeProfileView } from './EmployeeProfileView';
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

  // Active navigation tab governed by sidebar selection (Admin defaults to 'tree', Employee to 'tasks')
  const [activeTab, setActiveTab] = useState(() => (isAdmin ? 'tree' : 'tasks'));

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
      const isAdministrator = user?.role === 'admin';
      const [projectsData, tasksData, adminData, meetingsData, notifsData] = await Promise.all([
        api.getProjects().catch(() => []),
        api.getTasks().catch(() => []),
        isAdministrator ? api.getAdminEmployees().catch(() => ({ employees: [] })) : Promise.resolve({ employees: [] }),
        api.getMeetings().catch(() => []),
        api.getNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
      ]);
      setProjects(projectsData || []);
      setTasks(tasksData || []);
      if (isAdministrator) setEmployees(adminData?.employees || []);
      setMeetings(meetingsData || []);
      setNotifications(notifsData?.notifications || []);
      setUnreadNotifCount(notifsData?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
    }
  };

  useEffect(() => {
    let active = true;
    const isAdministrator = user?.role === 'admin';
    Promise.all([
      api.getProjects().catch(() => []),
      api.getTasks().catch(() => []),
      isAdministrator ? api.getAdminEmployees().catch(() => ({ employees: [] })) : Promise.resolve({ employees: [] }),
      api.getMeetings().catch(() => []),
      api.getNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
    ])
      .then(([projectsData, tasksData, adminData, meetingsData, notifsData]) => {
        if (active) {
          setProjects(projectsData || []);
          setTasks(tasksData || []);
          if (isAdministrator) setEmployees(adminData?.employees || []);
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
  }, [user]);

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
    setIsTaskModalOpen(false);
    try {
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
      await refreshAllData();
    } catch (err) {
      console.error('Failed to save task:', err);
      alert(err.message || 'Failed to save task');
    }
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

  // Real Metric Computations (reflecting actual tasks in the workspace)
  const totalTasksCount = tasks.length;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'in-progress').length;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const todoTasksCount = tasks.filter((t) => !t.status || t.status === 'not-started').length;

  // Real Tasks this week
  const tasksThisWeekCount = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return tasks.filter((t) => new Date(t.createdAt || t.updatedAt || 0) >= startOfWeek).length;
  }, [tasks]);

  // Real Completion percentages for Donut Chart
  const pctCompleted = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const pctInProgress = totalTasksCount > 0 ? Math.round((inProgressTasksCount / totalTasksCount) * 100) : 0;
  const pctTodo = totalTasksCount > 0 ? Math.max(0, 100 - pctCompleted - pctInProgress) : 0;

  // Real Priority counts
  const highPriorityCount = tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;
  const medPriorityCount = tasks.filter((t) => t.priority === 'medium').length;
  const lowPriorityCount = tasks.filter((t) => t.priority === 'low').length;

  // Real Today's Tasks
  const todaysTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return tasks.filter((t) => {
      const d = t.deadline || t.dueDate;
      return d && d.startsWith(todayStr);
    });
  }, [tasks]);

  // Real Upcoming Tasks & Meetings
  const upcomingItems = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const items = [];
    tasks.forEach((t) => {
      const d = t.deadline || t.dueDate;
      if (d && d >= todayStr && t.status !== 'completed') {
        items.push({
          id: t._id || t.id,
          type: 'task',
          title: t.title,
          date: d,
          priority: t.priority || 'medium',
        });
      }
    });
    meetings.forEach((m) => {
      if (m.date && m.date >= todayStr && m.status === 'scheduled') {
        items.push({
          id: m._id || m.id,
          type: 'meeting',
          title: m.title,
          date: m.date,
          priority: 'medium',
          isMeeting: true,
        });
      }
    });
    return items.sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 5);
  }, [tasks, meetings]);

  // Real Task Timeline (Recent Activity derived from real tasks)
  const recentActivities = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    const sorted = [...tasks].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
    );
    return sorted.slice(0, 5).map((t) => {
      const d = t.updatedAt || t.createdAt ? new Date(t.updatedAt || t.createdAt) : new Date();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const assignee = t.assignedToName && t.assignedToName !== 'Unassigned' ? t.assignedToName : 'Staff';
      const userInitial = assignee ? assignee[0].toUpperCase() : 'U';

      let action = `updated "${t.title}"`;
      let dotClass = 'dot-blue';
      if (t.status === 'completed') {
        action = `${assignee} completed "${t.title}"`;
        dotClass = 'dot-green';
      } else if (t.status === 'submitted') {
        action = `${assignee} submitted "${t.title}" for review`;
        dotClass = 'dot-purple';
      } else if (t.status === 'in-progress') {
        action = `${assignee} moved "${t.title}" → In Progress`;
        dotClass = 'dot-orange';
      } else {
        action = `created task "${t.title}"`;
        dotClass = 'dot-blue';
      }

      return {
        id: t._id || t.id,
        time: timeStr,
        userInitial,
        text: action,
        dotClass,
      };
    });
  }, [tasks]);

  // Real Team Workload derived from employees and tasks
  const teamWorkloads = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    return employees.slice(0, 5).map((emp) => {
      const empId = (emp._id || emp.id || '').toString();
      const empTasks = tasks.filter((t) => {
        const assigned = (t.assignedTo?._id || t.assignedTo || '').toString();
        return assigned === empId;
      });
      const total = empTasks.length;
      const completed = empTasks.filter((t) => t.status === 'completed').length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const initials = `${emp.firstName ? emp.firstName[0] : ''}${emp.lastName ? emp.lastName[0] : ''}`.toUpperCase() || 'E';
      return {
        id: empId,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name,
        initials,
        pct,
        taskCount: total,
      };
    });
  }, [employees, tasks]);

  const totalAssignedTasks = tasks.filter((t) => t.assignedTo).length;
  const overallCapacityPct = tasks.length > 0 ? Math.round((totalAssignedTasks / tasks.length) * 100) : 0;

  // Kanban Columns (matching Reference UI screenshot)
  const kanbanColumns = [
    { id: 'not-started', title: 'To Do', accent: 'col-todo', headerTint: 'tint-todo' },
    { id: 'in-progress', title: 'In Progress', accent: 'col-progress', headerTint: 'tint-progress' },
    { id: 'submitted', title: 'In Review', accent: 'col-review', headerTint: 'tint-review' },
    { id: 'completed', title: 'Done', accent: 'col-done', headerTint: 'tint-done' },
  ];

  // User initials & presentation from authenticated user
  const userInitials =
    user && user.firstName
      ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}`.toUpperCase()
      : 'U';

  const userDisplayName =
    user && user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : 'Taskflow User';

  const userDisplayRole =
    user?.positionTitle || user?.designation || (userRole === 'admin' ? 'Administrator' : 'Team Member');

  return (
    <div className="workspace-app-layout">
      {/* ========================================================
          1. LEFT SIDEBAR (Matching Reference UI Visuals)
          ======================================================== */}
      <aside className="workspace-sidebar">
        {/* Taskflow Brand Logo */}
        <div className="sidebar-brand">
          <div className="brand-icon-hexagon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" fill="#2563eb" stroke="#2563eb" />
              <circle cx="12" cy="12" r="3" fill="#ffffff" stroke="#ffffff" />
            </svg>
          </div>
          <span className="brand-text">Taskflow</span>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tree' ? 'active' : ''}`}
                onClick={() => setActiveTab('tree')}
              >
                <GitBranchIcon size={18} className="nav-icon" />
                <span>Org Tree</span>
              </button>

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
                className={`sidebar-nav-item ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
              >
                <UsersIcon size={18} className="nav-icon" />
                <span>Team & Invites</span>
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
                className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <SettingsIcon size={18} className="nav-icon" />
                <span>Settings</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tasks' || activeTab === 'overview' || activeTab === 'projects' || activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <CheckSquareIcon size={18} className="nav-icon" />
                <span>My Dashboard</span>
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
                className={`sidebar-nav-item ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => setActiveTab('messages')}
              >
                <MessageSquareIcon size={18} className="nav-icon" />
                <span>Messages</span>
                {unreadNotifCount > 0 && <span className="sidebar-badge">{unreadNotifCount}</span>}
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <UserIcon size={18} className="nav-icon" />
                <span>My Profile</span>
              </button>
            </>
          )}
        </nav>

        {/* Sidebar User Profile Capsule at Bottom */}
        <div className="sidebar-user-bottom" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
          <div className="user-avatar-circle">
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt="User Avatar" className="avatar-img-fit" />
            ) : (
              userInitials
            )}
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
                <span className="menu-email">{user?.email || 'alex@taskflow.com'}</span>
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
              {activeTab === 'tree' && 'Organizational Tree & Hierarchy'}
              {activeTab === 'tasks' && (!isAdmin ? 'Unified Employee Dashboard' : 'Taskflow Tasks')}
              {activeTab === 'calendar' && 'Calendar & Meetings'}
              {activeTab === 'overview' && 'Executive Administration Overview'}
              {activeTab === 'projects' && 'Projects'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'documents' && 'Documents'}
              {activeTab === 'messages' && 'Messages & Notifications'}
              {activeTab === 'team' && 'Team & Personnel Management'}
              {activeTab === 'settings' && 'Taskflow Settings'}
              {activeTab === 'profile' && 'User Profile'}
            </h1>
            <p className="page-subheading">
              {activeTab === 'tree' && 'Parent-child tree structure, active employee mapping, and dynamic reporting relationships'}
              {activeTab === 'tasks' && (!isAdmin ? 'Submission Panel (work delivery & milestone completion) and Assignment Panel (reporting delegation)' : "Manage and track organization team's work")}
              {activeTab === 'calendar' && 'Schedule meetings, monitor deadlines, and track action items'}
              {activeTab === 'overview' && 'Executive summary, progress health, and organization KPIs'}
              {activeTab === 'projects' && 'Project deliverables, milestone tracks, and inspection'}
              {activeTab === 'analytics' && 'Performance analytics, team velocity, and task completion'}
              {activeTab === 'documents' && 'Review submissions, project attachments, and files'}
              {activeTab === 'messages' && 'Taskflow communications and meeting invitations'}
              {activeTab === 'team' && 'Department structure, personnel, and secure invitations'}
              {activeTab === 'settings' && 'Organization hierarchy, access scopes, and permissions'}
              {activeTab === 'profile' && 'Manage your account credentials and personal information'}
            </p>
          </div>

          <div className="top-bar-right">
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

            {/* Add Task Button (Visible to authorized assigners) */}
            {(isAdmin || perms.canAssignTasks || perms.canCreateTasks) && (
              <button
                type="button"
                className="btn btn-primary top-add-task-btn"
                onClick={() => handleOpenNewTask()}
              >
                <PlusIcon size={16} />
                <span>Add Task</span>
              </button>
            )}

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
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="User Avatar" className="avatar-img-fit" />
              ) : (
                userInitials
              )}
            </div>
          </div>
        </header>

        {/* ========================================================
            3. TAB CONTENT
            ======================================================== */}
        <main className="workspace-main-content">
          {/* NON-ADMIN EMPLOYEES: UNIFIED EMPLOYEE DASHBOARD (Submission Panel + Assignment Panel) */}
          {!isAdmin && (activeTab === 'tasks' || activeTab === 'overview' || activeTab === 'projects' || activeTab === 'team') && (
            <UnifiedEmployeeDashboard
              user={user}
              tasks={tasks}
              projects={projects}
              onOpenNewTask={(projId, parentId) => handleOpenNewTask(projId, parentId)}
              onOpenSubmitModal={(task) => {
                setSubmittingTask(task);
                setIsSubmitModalOpen(true);
              }}
              onOpenReviewModal={(task) => {
                setReviewingTask(task);
                setIsReviewModalOpen(true);
              }}
              onTasksUpdated={refreshAllData}
            />
          )}

          {/* MAIN ADMIN: ORGANIZATIONAL TREE TAB */}
          {isAdmin && activeTab === 'tree' && (
            <OrgTreeManagement onHierarchyUpdated={refreshAllData} />
          )}

          {/* MAIN ADMIN: TASKS TAB */}
          {isAdmin && activeTab === 'tasks' && (
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
                  {totalTasksCount > 0 ? (
                    <div className="metric-trend trend-green">
                      <span className="trend-arrow">↑</span>
                      <span>{tasksThisWeekCount} this week</span>
                    </div>
                  ) : (
                    <div className="metric-trend trend-neutral">
                      <span>No tasks yet</span>
                    </div>
                  )}
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
                  {inProgressTasksCount > 0 ? (
                    <div className="metric-trend trend-orange">
                      <span className="trend-arrow">●</span>
                      <span>{inProgressTasksCount} active</span>
                    </div>
                  ) : (
                    <div className="metric-trend trend-neutral">
                      <span>None in progress</span>
                    </div>
                  )}
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
                  {completedTasksCount > 0 ? (
                    <div className="metric-trend trend-green">
                      <span className="trend-arrow">↑</span>
                      <span>{completedTasksCount} completed</span>
                    </div>
                  ) : (
                    <div className="metric-trend trend-neutral">
                      <span>None completed</span>
                    </div>
                  )}
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
                        {pctCompleted > 0 && (
                          <path
                            className="donut-segment segment-completed"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="4"
                            strokeDasharray={`${pctCompleted}, 100`}
                          />
                        )}
                        {pctInProgress > 0 && (
                          <path
                            className="donut-segment segment-progress"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="4"
                            strokeDasharray={`${pctInProgress}, 100`}
                            strokeDashoffset={`-${pctCompleted}`}
                          />
                        )}
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
                      <div className="bar-col" style={{ height: totalTasksCount > 0 ? `${Math.max(15, pctTodo)}%` : '15%' }}></div>
                      <div className="bar-col" style={{ height: totalTasksCount > 0 ? `${Math.max(15, pctInProgress)}%` : '15%' }}></div>
                      <div className="bar-col" style={{ height: totalTasksCount > 0 ? `${Math.max(15, pctCompleted)}%` : '15%' }}></div>
                      <div className="bar-col" style={{ height: totalTasksCount > 0 ? `${Math.max(15, Math.round((pctInProgress + pctCompleted) / 2))}%` : '15%' }}></div>
                      <div className="bar-col" style={{ height: totalTasksCount > 0 ? `${Math.max(15, pctCompleted)}%` : '15%' }}></div>
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
                            {colTasks.length === 0 ? (
                              <div className="ref-col-empty-placeholder">
                                <span>No tasks</span>
                              </div>
                            ) : (
                              colTasks.map((t) => {
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
                                  <div
                                    key={t._id || t.id}
                                    className="ref-task-card animate-scale-up"
                                    onClick={() => {
                                      if (t.status === 'submitted') {
                                        setReviewingTask(t);
                                        setIsReviewModalOpen(true);
                                      } else {
                                        setEditingTask(t);
                                        setIsTaskModalOpen(true);
                                      }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <div className="card-row-top">
                                      <div className="title-with-dot">
                                        <span className={`priority-indicator-dot ${dotColor}`}></span>
                                        <strong className="card-task-title">{t.title}</strong>
                                      </div>
                                      <button
                                        type="button"
                                        className="three-dots-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTask(t._id || t.id);
                                        }}
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
                                        {t.deadline ? new Date(t.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No date'}
                                      </span>
                                      <div className="card-assignee-avatar">
                                        {t.assignedToName && t.assignedToName !== 'Unassigned' ? t.assignedToName[0].toUpperCase() : 'A'}
                                      </div>
                                    </div>

                                    {t.status === 'submitted' && (
                                      <button
                                        type="button"
                                        className="btn btn-outline-warning btn-xs kanban-review-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReviewingTask(t);
                                          setIsReviewModalOpen(true);
                                        }}
                                        style={{ marginTop: '8px', width: '100%', fontSize: '11px', padding: '4px 8px' }}
                                      >
                                        <CheckCircleIcon size={12} /> Review Deliverable
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            )}
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

                    {todaysTasks.length === 0 ? (
                      <div className="side-card-empty-state">
                        <CheckSquareIcon size={24} className="empty-icon-muted" />
                        <p>No tasks scheduled for today</p>
                        <button
                          type="button"
                          className="btn-link-sm"
                          onClick={() => handleOpenNewTask()}
                        >
                          + Create a task
                        </button>
                      </div>
                    ) : (
                      <div className="todays-tasks-list">
                        {todaysTasks.slice(0, 6).map((t) => {
                          const isDone = t.status === 'completed';
                          const cat = getTaskCategory(t);
                          const timeStr = t.deadline
                            ? new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'All Day';

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
                    )}
                  </div>

                  {/* Card 2: Upcoming */}
                  <div className="ref-side-card">
                    <div className="side-card-header">
                      <h4>Upcoming</h4>
                      <button type="button" className="view-all-link" onClick={() => setActiveTab('calendar')}>
                        View All
                      </button>
                    </div>

                    {upcomingItems.length === 0 ? (
                      <div className="side-card-empty-state">
                        <CalendarIcon size={24} className="empty-icon-muted" />
                        <p>No upcoming tasks or meetings</p>
                        <button
                          type="button"
                          className="btn-link-sm"
                          onClick={() => handleOpenNewTask()}
                        >
                          + Schedule upcoming task
                        </button>
                      </div>
                    ) : (
                      <div className="upcoming-items-list">
                        {upcomingItems.map((item) => {
                          const dateFormatted = item.date
                            ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
                            : 'TBD';
                          const tagClass =
                            item.priority === 'urgent' || item.priority === 'high'
                              ? 'tag-high'
                              : item.priority === 'low'
                              ? 'tag-low'
                              : 'tag-medium';

                          return (
                            <div key={item.id} className="upcoming-item-row">
                              <div className="upcoming-date-box">
                                <CalendarIcon size={13} className="text-primary" />
                                <span>{dateFormatted}</span>
                              </div>
                              <span className="upcoming-title" title={item.title}>{item.title}</span>
                              <span className={`priority-pill-tag ${tagClass}`}>
                                {item.isMeeting ? 'Meeting' : item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : 'Medium'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
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

                  {recentActivities.length === 0 ? (
                    <div className="side-card-empty-state">
                      <ActivityIcon size={24} className="empty-icon-muted" />
                      <p>No recent activity recorded yet</p>
                    </div>
                  ) : (
                    <div className="timeline-items-list">
                      {recentActivities.map((act) => (
                        <div key={act.id} className="timeline-item">
                          <span className="timeline-time">{act.time}</span>
                          <div className="timeline-dot-line">
                            <span className={`dot ${act.dotClass}`}></span>
                            <span className="vert-line"></span>
                          </div>
                          <div className="timeline-user-avatar">{act.userInitial}</div>
                          <div className="timeline-text">{act.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
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
                    {teamWorkloads.length === 0 ? (
                      <div className="side-card-empty-state" style={{ flex: 1 }}>
                        <UsersIcon size={24} className="empty-icon-muted" />
                        <p>No team members assigned</p>
                      </div>
                    ) : (
                      <div className="workload-members-list">
                        {teamWorkloads.map((m) => (
                          <div key={m.id} className="workload-member-row">
                            <div className="member-avatar">{m.initials}</div>
                            <span className="member-name">{m.name}</span>
                            <div className="progress-bar-container">
                              <div className="progress-fill" style={{ width: `${m.pct}%` }}></div>
                            </div>
                            <span className="member-pct">{m.pct}%</span>
                          </div>
                        ))}
                      </div>
                    )}

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
                          {overallCapacityPct > 0 && (
                            <path
                              className="donut-segment segment-completed"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="4"
                              strokeDasharray={`${overallCapacityPct}, 100`}
                            />
                          )}
                        </svg>
                        <div className="gauge-center-text">
                          <strong>{overallCapacityPct}%</strong>
                          <span>Capacity</span>
                        </div>
                      </div>

                      <div className="gauge-legend">
                        <div className="gauge-legend-item">
                          <span className="dot dot-gray"></span> Available {100 - overallCapacityPct}%
                        </div>
                        <div className="gauge-legend-item">
                          <span className="dot dot-blue"></span> Utilized {overallCapacityPct}%
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
                      {totalTasksCount === 0 ? (
                        <div className="p-bar-seg" style={{ width: '100%', background: '#e2e8f0' }}></div>
                      ) : (
                        <>
                          <div
                            className="p-bar-seg seg-high"
                            style={{ width: `${(highPriorityCount / totalTasksCount) * 100}%` }}
                          ></div>
                          <div
                            className="p-bar-seg seg-medium"
                            style={{ width: `${(medPriorityCount / totalTasksCount) * 100}%` }}
                          ></div>
                          <div
                            className="p-bar-seg seg-low"
                            style={{ width: `${(lowPriorityCount / totalTasksCount) * 100}%` }}
                          ></div>
                        </>
                      )}
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
          {isAdmin && activeTab === 'overview' && (
            <AdminSummaryView
              projects={projects}
              tasks={tasks}
              loading={loading}
              onOpenNewProject={() => {
                setEditingProject(null);
                setIsProjectModalOpen(true);
              }}
              onInspectProject={handleInspectProject}
            />
          )}

          {/* TAB: PROJECTS (Admin Project View) */}
          {isAdmin && activeTab === 'projects' && (
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

          {/* TAB: TEAM (Admin Employee Panel with Invitations & Profiles) */}
          {isAdmin && activeTab === 'team' && (
            <AdminEmployeePanel
              companyName={user?.companyName}
              onTestAcceptInvite={onTestAcceptInvite}
            />
          )}

          {/* TAB: SETTINGS (Organization Structure & Permissions Builder) */}
          {isAdmin && activeTab === 'settings' && (
            <OrganizationStructureBuilder
              employees={employees}
              onHierarchyUpdated={refreshAllData}
            />
          )}

          {/* TAB: MESSAGES (Notifications & Meeting Updates) */}
          {activeTab === 'messages' && (
            <div className="messages-center-card animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Taskflow Notifications & Messages</h3>
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
              tasks={tasks}
              loading={loading}
              onOpenNewProject={() => {
                setEditingProject(null);
                setIsProjectModalOpen(true);
              }}
              onInspectProject={handleInspectProject}
            />
          )}

          {/* TAB: PROFILE (LINKEDIN-INSPIRED ENHANCED EMPLOYEE PROFILE) */}
          {activeTab === 'profile' && (
            <EmployeeProfileView
              user={user}
              isAdmin={isAdmin}
              onProfileUpdated={(updatedUser) => {
                if (onUpdateUser) onUpdateUser(updatedUser);
                refreshAllData();
              }}
            />
          )}
        </main>
      </div>

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
