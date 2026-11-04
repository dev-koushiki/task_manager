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
  VideoIcon,
  MailIcon,
  AwardIcon,
  ClockIcon,
  MonitorIcon,
  LifeBuoyIcon,
} from './Icons';
import { PerformanceDashboardView } from './PerformanceDashboardView';
import { EmployeeDirectoryModal } from './EmployeeDirectoryModal';
import { GroupingChatView } from './GroupingChatView';
import { ProjectSectionView } from './ProjectSectionView';
import { MyProgressView } from './MyProgressView';
import { WorkConnectView } from './WorkConnectView';
import { HelpDeskView } from './HelpDeskView';
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
import { ConnectView } from './ConnectView';
import { OrgTreeManagement } from './OrgTreeManagement';
import { UnifiedEmployeeDashboard } from './UnifiedEmployeeDashboard';
import { EmployeeProfileView } from './EmployeeProfileView';
import { GlobalSearchBar } from './GlobalSearchBar';
import { ThemeToggle } from './ThemeToggle';
import { ErrorBoundary } from './ErrorBoundary';
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
  const [tasksTabMode, setTasksTabMode] = useState('board'); // 'board' (default) | 'list' | 'projects' | 'analytics'
  const [sortBy, setSortBy] = useState('priority'); // 'priority' | 'deadline' | 'alphabetical' | 'newest'
  const [showScheduleSection, setShowScheduleSection] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState(null);
  const [targetMilestoneId, setTargetMilestoneId] = useState(null);

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
  const [connectRoomCode, setConnectRoomCode] = useState('');
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [selectedEmployeeForEval, setSelectedEmployeeForEval] = useState(null);
  const [workConnectTaskId, setWorkConnectTaskId] = useState(null);
  const [incomingWcCount, setIncomingWcCount] = useState(0);

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

  // Background polling for notifications every 15 seconds
  useEffect(() => {
    if (!user) return;
    const pollInterval = setInterval(() => {
      api
        .getNotifications()
        .then((notifsData) => {
          if (notifsData?.notifications) {
            setNotifications(notifsData.notifications);
            setUnreadNotifCount(notifsData.unreadCount || 0);
          }
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [user]);

  // Background polling for incoming WorkConnect connection requests
  useEffect(() => {
    if (!user) return;
    const fetchIncomingCount = () => {
      api
        .getIncomingWorkConnectRequests()
        .then((res) => {
          if (res?.incomingRequests) {
            setIncomingWcCount(res.incomingRequests.length);
          }
        })
        .catch(() => {});
    };
    fetchIncomingCount();
    const wcInterval = setInterval(fetchIncomingCount, 10000);
    return () => clearInterval(wcInterval);
  }, [user]);

  const handleOpenWorkConnectForTask = (taskId) => {
    setWorkConnectTaskId(taskId);
    setActiveTab('workconnect');
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

  const handleMarkSingleRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => ((n._id || n.id) === id ? { ...n, read: true } : n))
      );
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleDeleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => {
        const next = prev.filter((n) => (n._id || n.id) !== id);
        setUnreadNotifCount(next.filter((item) => !item.read).length);
        return next;
      });
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif) return;
    const notifId = notif._id || notif.id;

    // Mark as read immediately on server & update UI state
    if (!notif.read && notifId) {
      try {
        await api.markNotificationRead(notifId);
        setNotifications((prev) =>
          prev.map((n) => ((n._id || n.id) === notifId ? { ...n, read: true } : n))
        );
        setUnreadNotifCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        console.warn('Failed to mark notification as read:', e);
      }
    }

    setIsNotifDropdownOpen(false);

    // Parse notification link or metadata
    const link = notif.link || '';
    const projectId =
      notif.metadata?.projectId ||
      (link.includes('projectId=') ? new URLSearchParams(link.split('?')[1] || '').get('projectId') : null);
    const milestoneId =
      notif.metadata?.milestoneId ||
      (link.includes('milestoneId=') ? new URLSearchParams(link.split('?')[1] || '').get('milestoneId') : null);

    if (projectId) {
      setTargetProjectId(projectId);
      if (milestoneId) {
        setTargetMilestoneId(milestoneId);
      }
      setActiveTab('tasks');
      setTasksTabMode('projects');
      return;
    }

    if (link.includes('my-progress') || link.includes('my_progress')) {
      setActiveTab('my_progress');
      return;
    }
    if (link.includes('calendar')) {
      setActiveTab('calendar');
      return;
    }
    if (link.includes('grouping') || link.includes('group')) {
      setActiveTab('grouping');
      return;
    }
    if (link.includes('connect')) {
      setActiveTab('connect');
      return;
    }
    if (link.includes('profile')) {
      setActiveTab('profile');
      return;
    }
    if (link.includes('settings')) {
      setActiveTab(isAdmin ? 'settings' : 'profile');
      return;
    }

    // Default fallback: tasks tab
    setActiveTab('tasks');
  };

  // Global Search Result Selection Handler
  const handleSearchResultClick = (item) => {
    if (!item) return;

    if (item.type === 'project') {
      setTargetProjectId(item.id);
      setActiveTab('tasks');
      setTasksTabMode('projects');
      return;
    }

    if (item.type === 'milestone') {
      setTargetProjectId(item.projectId);
      setTargetMilestoneId(item.id);
      setActiveTab('tasks');
      setTasksTabMode('projects');
      return;
    }

    if (item.type === 'task') {
      setActiveTab('tasks');
      if (item.projectId) {
        setTargetProjectId(item.projectId);
      }
      return;
    }

    if (item.type === 'employee') {
      if (isAdmin) {
        setActiveTab('invites');
      } else {
        setActiveTab('profile');
      }
      return;
    }

    if (item.type === 'group') {
      setActiveTab('grouping');
      return;
    }

    if (item.type === 'message') {
      setActiveTab('grouping');
      return;
    }

    if (item.type === 'meeting') {
      setActiveTab('calendar');
      return;
    }

    if (item.type === 'document') {
      if (item.link && item.link.includes('projectId=')) {
        setTargetProjectId(item.projectId);
        setActiveTab('tasks');
        setTasksTabMode('projects');
      } else {
        setActiveTab('documents');
      }
      return;
    }

    // Default fallback
    setActiveTab('tasks');
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

  // Sorted and filtered tasks for Board & List views
  const sortedFilteredTasks = useMemo(() => {
    const list = [...filteredTasks];
    if (sortBy === 'priority') {
      const pWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
      list.sort((a, b) => (pWeights[b.priority] || 2) - (pWeights[a.priority] || 2));
    } else if (sortBy === 'deadline') {
      list.sort((a, b) => {
        const da = a.deadline || a.dueDate || '9999-99-99';
        const db = b.deadline || b.dueDate || '9999-99-99';
        return String(da).localeCompare(String(db));
      });
    } else if (sortBy === 'alphabetical') {
      list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
    }
    return list;
  }, [filteredTasks, sortBy]);

  // Real Metric Computations (reflecting actual tasks in the workspace)
  const totalTasksCount = tasks.length;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'in-progress').length;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const submittedTasksCount = tasks.filter((t) => t.status === 'submitted').length;
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
              {/* 1. Org Tree */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tree' ? 'active' : ''}`}
                onClick={() => setActiveTab('tree')}
              >
                <GitBranchIcon size={18} className="nav-icon" />
                <span>Org Tree</span>
              </button>

              {/* 2. Overview */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <HomeIcon size={18} className="nav-icon" />
                <span>Overview</span>
              </button>

              {/* 3. Tasks */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <CheckSquareIcon size={18} className="nav-icon" />
                <span>Tasks</span>
              </button>

              {/* 4. Group */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'grouping' ? 'active' : ''}`}
                onClick={() => setActiveTab('grouping')}
              >
                <UsersIcon size={18} className="nav-icon" />
                <span>Group</span>
              </button>

              {/* 5. Calendar */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendar')}
              >
                <CalendarIcon size={18} className="nav-icon" />
                <span>Calendar</span>
              </button>

              {/* 6. Connekt */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'connect' ? 'active' : ''}`}
                onClick={() => setActiveTab('connect')}
              >
                <VideoIcon size={18} className="nav-icon" />
                <span>Connekt</span>
              </button>

              {/* 7. WorkConnect (Remote Assistance) */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'workconnect' ? 'active' : ''}`}
                onClick={() => setActiveTab('workconnect')}
              >
                <MonitorIcon size={18} className="nav-icon" />
                <span>WorkConnect</span>
                {incomingWcCount > 0 && <span className="nav-badge-pill">{incomingWcCount}</span>}
              </button>

              {/* 8. Help Desk (AI Smart Ticketing) */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'helpdesk' ? 'active' : ''}`}
                onClick={() => setActiveTab('helpdesk')}
              >
                <LifeBuoyIcon size={18} className="nav-icon" />
                <span>Help Desk</span>
              </button>

              {/* 7. My Progress */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'my_progress' ? 'active' : ''}`}
                onClick={() => setActiveTab('my_progress')}
              >
                <TrendingUpIcon size={18} className="nav-icon" />
                <span>My Progress</span>
              </button>

              {/* 8. Performance */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedEmployeeForEval(user?._id);
                  setActiveTab('analytics');
                }}
              >
                <AwardIcon size={18} className="nav-icon" />
                <span>Performance</span>
              </button>

              {/* 9. Invites */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'invites' || activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('invites')}
              >
                <MailIcon size={18} className="nav-icon" />
                <span>Invites</span>
              </button>

              {/* 10. Settings */}
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
              {/* My Dashboard / Tasks */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tasks' || activeTab === 'overview' || activeTab === 'projects' || activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <CheckSquareIcon size={18} className="nav-icon" />
                <span>My Dashboard</span>
              </button>

              {/* Group */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'grouping' ? 'active' : ''}`}
                onClick={() => setActiveTab('grouping')}
              >
                <UsersIcon size={18} className="nav-icon" />
                <span>Group</span>
              </button>

              {/* Calendar */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendar')}
              >
                <CalendarIcon size={18} className="nav-icon" />
                <span>Calendar</span>
              </button>

              {/* Connekt */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'connect' ? 'active' : ''}`}
                onClick={() => setActiveTab('connect')}
              >
                <VideoIcon size={18} className="nav-icon" />
                <span>Connekt</span>
              </button>

              {/* WorkConnect (Remote Assistance) */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'workconnect' ? 'active' : ''}`}
                onClick={() => setActiveTab('workconnect')}
              >
                <MonitorIcon size={18} className="nav-icon" />
                <span>WorkConnect</span>
                {incomingWcCount > 0 && <span className="nav-badge-pill">{incomingWcCount}</span>}
              </button>

              {/* Help Desk (AI Smart Ticketing) */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'helpdesk' ? 'active' : ''}`}
                onClick={() => setActiveTab('helpdesk')}
              >
                <LifeBuoyIcon size={18} className="nav-icon" />
                <span>Help Desk</span>
              </button>

              {/* My Progress */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'my_progress' ? 'active' : ''}`}
                onClick={() => setActiveTab('my_progress')}
              >
                <TrendingUpIcon size={18} className="nav-icon" />
                <span>My Progress</span>
              </button>

              {/* Performance */}
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedEmployeeForEval(user?._id);
                  setActiveTab('analytics');
                }}
              >
                <AwardIcon size={18} className="nav-icon" />
                <span>Performance</span>
              </button>

              {/* My Profile */}
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
              {activeTab === 'connect' && 'Connekt'}
              {activeTab === 'workconnect' && 'WorkConnect Remote Assistance'}
              {activeTab === 'helpdesk' && 'AI Help Desk & Smart Ticket Management'}
              {activeTab === 'overview' && 'Executive Administration Overview'}
              {activeTab === 'projects' && 'Projects'}
              {activeTab === 'analytics' && 'Automated Performance Evaluation & Periodic Analytics'}
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
              {activeTab === 'connect' && 'Native in-website video conferencing, screen sharing, chat, and Google Calendar sync'}
              {activeTab === 'workconnect' && 'Independent browser-native screen sharing, real-time collaboration workspace, voice, video, and live annotations'}
              {activeTab === 'helpdesk' && 'AI-powered issue analysis, automated categorization, department routing, SLA monitoring, and resolution tracking'}
              {activeTab === 'overview' && 'Executive summary, progress health, and organization KPIs'}
              {activeTab === 'projects' && 'Project deliverables, milestone tracks, and inspection'}
              {activeTab === 'analytics' && 'Dynamic task delivery scoring, on-time telemetry, quality audits, and organization leaderboard'}
              {activeTab === 'documents' && 'Review submissions, project attachments, and files'}
              {activeTab === 'messages' && 'Taskflow communications and meeting invitations'}
              {activeTab === 'team' && 'Department structure, personnel, and secure invitations'}
              {activeTab === 'settings' && 'Organization hierarchy, access scopes, and permissions'}
              {activeTab === 'profile' && 'Manage your account credentials and personal information'}
            </p>
          </div>

          {/* Global Search Bar (Phase 7) */}
          <div className="top-bar-center">
            <GlobalSearchBar onSelectResult={handleSearchResultClick} />
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

            {/* New Task Button (Visible to authorized assigners) */}
            {(isAdmin || perms.canAssignTasks || perms.canCreateTasks) && (
              <button
                type="button"
                className="btn btn-primary top-add-task-btn"
                onClick={() => handleOpenNewTask()}
              >
                <PlusIcon size={16} />
                <span>New Task</span>
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
                        <div
                          key={n._id || n.id || i}
                          className={`notif-single-item ${!n.read ? 'unread' : ''}`}
                          onClick={() => handleNotificationClick(n)}
                          style={{ cursor: 'pointer' }}
                          title="Click to view linked project or record"
                        >
                          <div className="notif-icon-circle">
                            <SparklesIcon size={13} className="text-primary" />
                          </div>
                          <div className="notif-content" style={{ flex: 1 }}>
                            <strong>{n.title}</strong>
                            <p>{n.message}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                              <span className="notif-time">
                                {new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 600 }}>Open →</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Group Chat Icon */}
            <button
              type="button"
              className="top-round-icon-btn"
              onClick={() => setActiveTab('grouping')}
              title="Group Chat"
            >
              <MessageSquareIcon size={18} />
            </button>

            {/* Settings Icon */}
            <button
              type="button"
              className="top-round-icon-btn"
              onClick={() => setActiveTab(isAdmin ? 'settings' : 'profile')}
              title={isAdmin ? 'Settings' : 'Profile & Settings'}
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
          <ErrorBoundary key={activeTab} fallbackTitle="Error loading workspace view" onReset={refreshAllData}>
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
              onConnectForAssistance={handleOpenWorkConnectForTask}
            />
          )}

          {/* MAIN ADMIN: ORGANIZATIONAL TREE TAB */}
          {isAdmin && activeTab === 'tree' && (
            <OrgTreeManagement onHierarchyUpdated={refreshAllData} />
          )}

          {/* MAIN ADMIN: TASKS TAB */}
          {isAdmin && activeTab === 'tasks' && (
            <div className="tasks-container-view animate-fade-in">
              {/* 1. Header Banner */}
              <div className="tasks-top-header">
                <div className="tasks-header-info">
                  <h2 className="tasks-main-title">Tasks & Workflow</h2>
                  <p className="tasks-subtitle">
                    Organize daily tasks, track milestone progress across projects, and manage team deliverables.
                  </p>
                </div>

                <div className="tasks-header-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleOpenNewTask()}
                    title="Create a new task"
                  >
                    <PlusIcon size={16} />
                    <span>New Task</span>
                  </button>
                </div>
              </div>

              {/* 2. Interactive Quick Stats Cards */}
              <div className="tasks-quick-stats-grid">
                <div
                  className={`task-stat-card ${statusFilter === 'all' && (tasksTabMode === 'board' || tasksTabMode === 'list' || tasksTabMode === 'kanban') ? 'selected-filter' : ''}`}
                  onClick={() => {
                    setStatusFilter('all');
                    if (tasksTabMode === 'analytics' || tasksTabMode === 'projects') setTasksTabMode('board');
                  }}
                  title="View all workspace tasks"
                >
                  <div className="stat-card-top">
                    <span className="stat-card-label">Total Tasks</span>
                    <div className="stat-card-icon icon-blue">
                      <CheckSquareIcon size={18} />
                    </div>
                  </div>
                  <div className="stat-card-value">{totalTasksCount}</div>
                  <div className="stat-card-meta">
                    <span>{tasksThisWeekCount} added this week</span>
                  </div>
                </div>

                <div
                  className={`task-stat-card ${statusFilter === 'in-progress' && (tasksTabMode === 'board' || tasksTabMode === 'list' || tasksTabMode === 'kanban') ? 'selected-filter' : ''}`}
                  onClick={() => {
                    setStatusFilter('in-progress');
                    if (tasksTabMode === 'analytics' || tasksTabMode === 'projects') setTasksTabMode('board');
                  }}
                  title="Filter by In Progress"
                >
                  <div className="stat-card-top">
                    <span className="stat-card-label">In Progress</span>
                    <div className="stat-card-icon icon-green">
                      <ActivityIcon size={18} />
                    </div>
                  </div>
                  <div className="stat-card-value">{inProgressTasksCount}</div>
                  <div className="stat-card-meta">
                    <span>Currently being worked on</span>
                  </div>
                </div>

                <div
                  className={`task-stat-card ${statusFilter === 'submitted' && (tasksTabMode === 'board' || tasksTabMode === 'list' || tasksTabMode === 'kanban') ? 'selected-filter' : ''}`}
                  onClick={() => {
                    setStatusFilter('submitted');
                    if (tasksTabMode === 'analytics' || tasksTabMode === 'projects') setTasksTabMode('board');
                  }}
                  title="Filter by In Review"
                >
                  <div className="stat-card-top">
                    <span className="stat-card-label">In Review</span>
                    <div className="stat-card-icon icon-purple">
                      <ClockIcon size={18} />
                    </div>
                  </div>
                  <div className="stat-card-value">{submittedTasksCount}</div>
                  <div className="stat-card-meta">
                    <span className={submittedTasksCount > 0 ? 'text-warning font-semibold' : ''}>
                      {submittedTasksCount > 0 ? `${submittedTasksCount} pending review` : 'No pending reviews'}
                    </span>
                  </div>
                </div>

                <div
                  className={`task-stat-card ${statusFilter === 'completed' && (tasksTabMode === 'board' || tasksTabMode === 'list' || tasksTabMode === 'kanban') ? 'selected-filter' : ''}`}
                  onClick={() => {
                    setStatusFilter('completed');
                    if (tasksTabMode === 'analytics' || tasksTabMode === 'projects') setTasksTabMode('board');
                  }}
                  title="Filter by Completed"
                >
                  <div className="stat-card-top">
                    <span className="stat-card-label">Completed</span>
                    <div className="stat-card-icon icon-emerald">
                      <CheckCircleIcon size={18} />
                    </div>
                  </div>
                  <div className="stat-card-value">{completedTasksCount}</div>
                  <div className="stat-card-meta">
                    <span>{pctCompleted}% overall completion</span>
                  </div>
                </div>
              </div>

              {/* 3. Sub-View Segmented Navigation */}
              <div className="tasks-subnav-bar">
                <div className="tasks-subnav-tabs">
                  <button
                    type="button"
                    className={`subnav-tab-btn ${tasksTabMode === 'board' || tasksTabMode === 'kanban' ? 'active' : ''}`}
                    onClick={() => {
                      setTasksTabMode('board');
                      setViewMode('kanban');
                    }}
                  >
                    <LayersIcon size={16} />
                    <span>Board View</span>
                  </button>

                  <button
                    type="button"
                    className={`subnav-tab-btn ${tasksTabMode === 'list' ? 'active' : ''}`}
                    onClick={() => {
                      setTasksTabMode('list');
                      setViewMode('list');
                    }}
                  >
                    <FileTextIcon size={16} />
                    <span>List View</span>
                  </button>

                  <button
                    type="button"
                    className={`subnav-tab-btn ${tasksTabMode === 'projects' ? 'active' : ''}`}
                    onClick={() => setTasksTabMode('projects')}
                  >
                    <SparklesIcon size={16} />
                    <span>Projects & Milestones</span>
                    <span className="subnav-pill">{projects.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`subnav-tab-btn ${tasksTabMode === 'analytics' ? 'active' : ''}`}
                    onClick={() => setTasksTabMode('analytics')}
                  >
                    <ActivityIcon size={16} />
                    <span>Overview & Metrics</span>
                  </button>
                </div>

                <div className="tasks-subnav-summary">
                  {(tasksTabMode === 'board' || tasksTabMode === 'list' || tasksTabMode === 'kanban') && (
                    <span className="tasks-count-indicator">
                      Showing <strong>{sortedFilteredTasks.length}</strong> of <strong>{totalTasksCount}</strong> tasks
                    </span>
                  )}
                </div>
              </div>

              {/* ================= VIEW: BOARD OR LIST ================= */}
              {(tasksTabMode === 'board' || tasksTabMode === 'list' || tasksTabMode === 'kanban') && (
                <div className="tasks-workspace-body animate-fade-in">
                  {/* Clean Toolbar */}
                  <div className="tasks-clean-toolbar">
                    <div className="toolbar-search-wrap">
                      <SearchIcon size={15} className="toolbar-search-icon" />
                      <input
                        type="text"
                        placeholder="Search tasks by title, description or assignee..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="toolbar-search-field"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="toolbar-clear-btn"
                          onClick={() => setSearchQuery('')}
                          title="Clear search"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    <div className="toolbar-filters-group">
                      {/* Status Pills */}
                      <div className="toolbar-pills-row">
                        {['all', 'not-started', 'in-progress', 'submitted', 'completed'].map((st) => {
                          const label =
                            st === 'all'
                              ? 'All'
                              : st === 'not-started'
                              ? 'To Do'
                              : st === 'in-progress'
                              ? 'In Progress'
                              : st === 'submitted'
                              ? 'In Review'
                              : 'Done';
                          return (
                            <button
                              key={st}
                              type="button"
                              className={`toolbar-pill-btn ${statusFilter === st ? 'active' : ''}`}
                              onClick={() => setStatusFilter(st)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Priority Filter */}
                      <div className="toolbar-select-item">
                        <label>Priority:</label>
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

                      {/* Sort Dropdown */}
                      <div className="toolbar-select-item">
                        <label>Sort:</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                        >
                          <option value="priority">Priority (High to Low)</option>
                          <option value="deadline">Upcoming Deadline</option>
                          <option value="alphabetical">Alphabetical (A-Z)</option>
                          <option value="newest">Recently Created</option>
                        </select>
                      </div>

                      {/* Clear All Filters Button */}
                      {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
                        <button
                          type="button"
                          className="toolbar-reset-link"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                            setPriorityFilter('all');
                          }}
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </div>

                  {/* --- SUBVIEW 1: KANBAN BOARD --- */}
                  {(tasksTabMode === 'board' || tasksTabMode === 'kanban') && (
                    <div className="kanban-board-container animate-fade-in">
                      <div className="kanban-columns-grid">
                        {kanbanColumns.map((col) => {
                          const colTasks = sortedFilteredTasks.filter((t) => (t.status || 'not-started') === col.id);
                          return (
                            <div key={col.id} className={`kanban-column-card ${col.headerTint}`}>
                              {/* Column Header */}
                              <div className="kanban-column-header">
                                <div className="col-title-wrap">
                                  <span className="col-title-text">{col.title}</span>
                                  <span className={`col-counter-chip ${col.accent}`}>
                                    {colTasks.length}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="col-header-add-btn"
                                  onClick={() => handleOpenNewTask('', null, col.id)}
                                  title={`Add new task to ${col.title}`}
                                >
                                  <PlusIcon size={14} />
                                </button>
                              </div>

                              {/* Column Cards List */}
                              <div className="kanban-cards-stack">
                                {colTasks.length === 0 ? (
                                  <div className="kanban-column-empty">
                                    <p>No tasks in {col.title}</p>
                                    <button
                                      type="button"
                                      className="btn-link-xs"
                                      onClick={() => handleOpenNewTask('', null, col.id)}
                                    >
                                      + Add Task
                                    </button>
                                  </div>
                                ) : (
                                  colTasks.map((t) => {
                                    const cat = getTaskCategory(t);
                                    const isOverdue =
                                      (t.deadline || t.dueDate) &&
                                      (t.deadline || t.dueDate) < new Date().toISOString().split('T')[0] &&
                                      t.status !== 'completed';
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
                                        className="clean-task-card animate-scale-up"
                                        onClick={() => {
                                          if (t.status === 'submitted') {
                                            setReviewingTask(t);
                                            setIsReviewModalOpen(true);
                                          } else {
                                            setEditingTask(t);
                                            setIsTaskModalOpen(true);
                                          }
                                        }}
                                      >
                                        <div className="card-top-header">
                                          <div className="card-category-and-dot">
                                            <span className={`priority-indicator-dot ${dotColor}`}></span>
                                            <span className={`card-category-badge ${cat.color}`}>
                                              {cat.label}
                                            </span>
                                            {t.priority && (
                                              <span className={`card-priority-pill priority-${t.priority}`}>
                                                {t.priority.toUpperCase()}
                                              </span>
                                            )}
                                          </div>
                                          <div className="card-actions-menu">
                                            <button
                                              type="button"
                                              className="clean-card-icon-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTask(t._id || t.id);
                                              }}
                                              title="Delete task"
                                            >
                                              <TrashIcon size={13} />
                                            </button>
                                          </div>
                                        </div>

                                        <h4 className="clean-task-title">{t.title}</h4>
                                        {t.description && (
                                          <p className="clean-task-desc-snippet">{t.description}</p>
                                        )}

                                        {/* Card Meta Footer */}
                                        <div className="clean-card-footer">
                                          <div className={`card-deadline-tag ${isOverdue ? 'deadline-overdue' : ''}`}>
                                            <CalendarIcon size={12} />
                                            <span>
                                              {t.deadline || t.dueDate
                                                ? new Date(t.deadline || t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                                : 'No deadline'}
                                              {isOverdue && ' (Overdue)'}
                                            </span>
                                          </div>

                                          <div className="card-assignee-badge" title={t.assignedToName || 'Unassigned'}>
                                            <span className="assignee-avatar-circle">
                                              {t.assignedToName && t.assignedToName !== 'Unassigned'
                                                ? t.assignedToName[0].toUpperCase()
                                                : 'U'}
                                            </span>
                                            <span className="assignee-short-name">
                                              {t.assignedToName && t.assignedToName !== 'Unassigned'
                                                ? t.assignedToName.split(' ')[0]
                                                : 'Unassigned'}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Review Button for Submitted tasks */}
                                        {t.status === 'submitted' && (
                                          <button
                                            type="button"
                                            className="btn btn-warning btn-xs btn-review-card-action"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setReviewingTask(t);
                                              setIsReviewModalOpen(true);
                                            }}
                                          >
                                            <CheckCircleIcon size={13} />
                                            <span>Review Deliverable</span>
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Bottom Add Task Button */}
                              <button
                                type="button"
                                className="kanban-bottom-add-btn"
                                onClick={() => handleOpenNewTask('', null, col.id)}
                              >
                                <PlusIcon size={13} />
                                <span>Add Task</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* --- SUBVIEW 2: LIST VIEW --- */}
                  {tasksTabMode === 'list' && (
                    <div className="tasks-list-view-container animate-fade-in">
                      {sortedFilteredTasks.length === 0 ? (
                        <div className="list-view-empty-card">
                          <CheckSquareIcon size={40} className="text-muted" />
                          <h3>No tasks match your filter</h3>
                          <p>Try clearing filters or search query, or create a new task.</p>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleOpenNewTask()}
                          >
                            <PlusIcon size={15} /> Create New Task
                          </button>
                        </div>
                      ) : (
                        <div className="tasks-table-wrapper">
                          <table className="tasks-modern-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }}>Done</th>
                                <th>Task Title & Summary</th>
                                <th>Category / Domain</th>
                                <th>Assignee</th>
                                <th>Priority</th>
                                <th>Due Date</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedFilteredTasks.map((t) => {
                                const isDone = t.status === 'completed';
                                const isOverdue =
                                  (t.deadline || t.dueDate) &&
                                  (t.deadline || t.dueDate) < new Date().toISOString().split('T')[0] &&
                                  !isDone;
                                const cat = getTaskCategory(t);

                                return (
                                  <tr
                                    key={t._id || t.id}
                                    className={`task-table-row ${isDone ? 'row-done' : ''}`}
                                    onClick={() => {
                                      if (t.status === 'submitted') {
                                        setReviewingTask(t);
                                        setIsReviewModalOpen(true);
                                      } else {
                                        setEditingTask(t);
                                        setIsTaskModalOpen(true);
                                      }
                                    }}
                                  >
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        className={`checkbox-custom-btn ${isDone ? 'checked' : ''}`}
                                        onClick={() => handleToggleTaskDone(t)}
                                        title={isDone ? 'Mark as In Progress' : 'Mark as Completed'}
                                      >
                                        {isDone ? <CheckIcon size={12} className="check-mark-icon" /> : null}
                                      </button>
                                    </td>
                                    <td>
                                      <div className="table-task-info">
                                        <span className={`table-task-title ${isDone ? 'strikethrough' : ''}`}>
                                          {t.title}
                                        </span>
                                        {t.description && (
                                          <p className="table-task-desc">{t.description}</p>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`card-category-badge ${cat.color}`}>
                                        {cat.label}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="table-assignee-cell">
                                        <span className="assignee-avatar-circle">
                                          {t.assignedToName && t.assignedToName !== 'Unassigned'
                                            ? t.assignedToName[0].toUpperCase()
                                            : 'U'}
                                        </span>
                                        <span>{t.assignedToName || 'Unassigned'}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`card-priority-pill priority-${t.priority || 'medium'}`}>
                                        {(t.priority || 'medium').toUpperCase()}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`table-date-pill ${isOverdue ? 'text-danger font-semibold' : ''}`}>
                                        {t.deadline || t.dueDate
                                          ? new Date(t.deadline || t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                                          : 'No date'}
                                        {isOverdue && ' (Overdue)'}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`table-status-pill status-${t.status || 'not-started'}`}>
                                        {t.status === 'not-started'
                                          ? 'To Do'
                                          : t.status === 'in-progress'
                                          ? 'In Progress'
                                          : t.status === 'submitted'
                                          ? 'In Review'
                                          : 'Completed'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                      <div className="table-actions-cell">
                                        {t.status === 'submitted' && (
                                          <button
                                            type="button"
                                            className="btn btn-warning btn-xs"
                                            onClick={() => {
                                              setReviewingTask(t);
                                              setIsReviewModalOpen(true);
                                            }}
                                            title="Review deliverable"
                                          >
                                            Review
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="btn-icon-table"
                                          onClick={() => {
                                            setEditingTask(t);
                                            setIsTaskModalOpen(true);
                                          }}
                                          title="Edit task"
                                        >
                                          <EditIcon size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-icon-table text-danger"
                                          onClick={() => handleDeleteTask(t._id || t.id)}
                                          title="Delete task"
                                        >
                                          <TrashIcon size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible Today & Upcoming Accordion Below Board / List */}
                  <div className="tasks-collapsible-schedule-card">
                    <div
                      className="schedule-toggle-header"
                      onClick={() => setShowScheduleSection(!showScheduleSection)}
                    >
                      <div className="schedule-header-left">
                        <CalendarIcon size={16} className="text-primary" />
                        <strong>Today&apos;s Focus & Upcoming Deadlines</strong>
                        <span className="schedule-count-badge">
                          {todaysTasks.length} today · {upcomingItems.length} upcoming
                        </span>
                      </div>
                      <button type="button" className="schedule-chevron-btn" aria-label="Toggle schedule">
                        <ChevronDownIcon
                          size={16}
                          className={`transition-transform ${showScheduleSection ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>

                    {showScheduleSection && (
                      <div className="schedule-collapsible-body animate-fade-in">
                        <div className="schedule-dual-columns">
                          {/* Column 1: Today's Tasks */}
                          <div className="schedule-subcol">
                            <h5>Today&apos;s Scheduled Tasks ({todaysTasks.length})</h5>
                            {todaysTasks.length === 0 ? (
                              <p className="schedule-empty-text">No tasks specifically scheduled for today.</p>
                            ) : (
                              <div className="schedule-items-list">
                                {todaysTasks.map((t) => {
                                  const isDone = t.status === 'completed';
                                  return (
                                    <div key={t._id || t.id} className="schedule-task-item">
                                      <button
                                        type="button"
                                        className={`checkbox-custom-btn ${isDone ? 'checked' : ''}`}
                                        onClick={() => handleToggleTaskDone(t)}
                                      >
                                        {isDone ? <CheckIcon size={12} className="check-mark-icon" /> : null}
                                      </button>
                                      <span className={`schedule-item-title ${isDone ? 'strikethrough' : ''}`}>
                                        {t.title}
                                      </span>
                                      <span className="schedule-item-assignee">{t.assignedToName || 'Unassigned'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Column 2: Upcoming Deadlines & Meetings */}
                          <div className="schedule-subcol">
                            <h5>Upcoming Deadlines & Meetings ({upcomingItems.length})</h5>
                            {upcomingItems.length === 0 ? (
                              <p className="schedule-empty-text">No upcoming deadlines within this period.</p>
                            ) : (
                              <div className="schedule-items-list">
                                {upcomingItems.map((item) => (
                                  <div key={item.id} className="schedule-upcoming-item">
                                    <span className="upcoming-item-date">{item.date}</span>
                                    <span className="upcoming-item-name">{item.title}</span>
                                    <span className={`upcoming-pill-badge tag-${item.priority || 'medium'}`}>
                                      {item.isMeeting ? 'Meeting' : (item.priority || 'Medium').toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= VIEW: PROJECTS & MILESTONES ================= */}
              {tasksTabMode === 'projects' && (
                <ProjectSectionView
                  user={user}
                  projects={projects}
                  initialProjectId={targetProjectId}
                  initialMilestoneId={targetMilestoneId}
                  onOpenNewProject={() => {
                    setEditingProject(null);
                    setIsProjectModalOpen(true);
                  }}
                  onEditProject={(proj) => {
                    setEditingProject(proj);
                    setIsProjectModalOpen(true);
                  }}
                  onDeleteProject={async (projId) => {
                    if (window.confirm('Are you sure you want to delete this project?')) {
                      await api.deleteProject(projId);
                      refreshAllData();
                    }
                  }}
                  onProjectsUpdated={refreshAllData}
                />
              )}

              {/* ================= VIEW: OVERVIEW & ANALYTICS ================= */}
              {tasksTabMode === 'analytics' && (
                <div className="tasks-analytics-tab-view animate-fade-in">
                  {/* Analytics Row 1: Task Completion Donut + Breakdown */}
                  <div className="analytics-overview-grid">
                    {/* Donut Card */}
                    <div className="analytics-card">
                      <h4>Task Completion Overview</h4>
                      <div className="completion-card-body">
                        <div className="donut-chart-container">
                          <svg width="88" height="88" viewBox="0 0 36 36" className="donut-svg">
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
                                stroke="#10b981"
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

                        <div className="donut-legend">
                          <div className="legend-row">
                            <span className="legend-dot" style={{ background: '#10b981' }}></span>
                            <span className="legend-name">Completed</span>
                            <strong className="legend-val">{pctCompleted}% ({completedTasksCount})</strong>
                          </div>
                          <div className="legend-row">
                            <span className="legend-dot dot-orange"></span>
                            <span className="legend-name">In Progress</span>
                            <strong className="legend-val">{pctInProgress}% ({inProgressTasksCount})</strong>
                          </div>
                          <div className="legend-row">
                            <span className="legend-dot dot-gray"></span>
                            <span className="legend-name">To Do</span>
                            <strong className="legend-val">{pctTodo}% ({todoTasksCount})</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Priority Breakdown */}
                    <div className="analytics-card">
                      <h4>Priority Distribution</h4>
                      <div className="priority-boxes-grid" style={{ marginTop: '12px' }}>
                        <div className="priority-box box-high">
                          <span className="p-box-label">Urgent / High</span>
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

                      <div className="priority-stacked-bar" style={{ marginTop: '16px' }}>
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
                      <div className="priority-total-text" style={{ marginTop: '8px' }}>
                        Total: {totalTasksCount} Workspace Tasks
                      </div>
                    </div>
                  </div>

                  {/* Analytics Row 2: Team Workload & Activity Timeline */}
                  <div className="analytics-bottom-grid">
                    {/* Team Workload */}
                    <div className="analytics-card">
                      <div className="side-card-header">
                        <h4>Team Member Workload</h4>
                        <span className="text-muted" style={{ fontSize: '12px' }}>
                          Capacity: {overallCapacityPct}% Utilized
                        </span>
                      </div>
                      {teamWorkloads.length === 0 ? (
                        <div className="side-card-empty-state">
                          <UsersIcon size={24} className="empty-icon-muted" />
                          <p>No team members assigned yet</p>
                        </div>
                      ) : (
                        <div className="workload-members-list" style={{ marginTop: '10px' }}>
                          {teamWorkloads.map((m) => (
                            <div key={m.id} className="workload-member-row">
                              <div className="member-avatar">{m.initials}</div>
                              <span className="member-name">{m.name}</span>
                              <div className="progress-bar-container">
                                <div className="progress-fill" style={{ width: `${m.pct}%` }}></div>
                              </div>
                              <span className="member-pct">{m.taskCount} tasks ({m.pct}%)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Activity Timeline */}
                    <div className="analytics-card">
                      <div className="side-card-header">
                        <h4>Recent Task Activity</h4>
                      </div>
                      {recentActivities.length === 0 ? (
                        <div className="side-card-empty-state">
                          <ActivityIcon size={24} className="empty-icon-muted" />
                          <p>No recent task activity recorded</p>
                        </div>
                      ) : (
                        <div className="timeline-items-list" style={{ marginTop: '10px' }}>
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
                  </div>
                </div>
              )}
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
              onJoinConnectMeeting={(roomCode) => {
                setConnectRoomCode(roomCode);
                setActiveTab('connect');
              }}
            />
          )}

          {/* TAB: CONNECT (Built-in Video Meetings, WebRTC & Google Workspace) */}
          {activeTab === 'connect' && (
            <ConnectView
              user={user}
              initialRoomCode={connectRoomCode}
              onScheduleInCalendar={() => setActiveTab('calendar')}
              onBackToCalendar={() => setActiveTab('calendar')}
            />
          )}

          {/* TAB: WORKCONNECT (Real-Time Remote Assistance & Collaboration) */}
          {activeTab === 'workconnect' && (
            <WorkConnectView
              user={user}
              tasks={tasks}
              projects={projects}
              preselectedTaskId={workConnectTaskId}
            />
          )}

          {/* TAB: HELPDESK (AI-Powered Help Desk & Smart Ticket Management) */}
          {activeTab === 'helpdesk' && (
            <HelpDeskView
              user={user}
              tasks={tasks}
              projects={projects}
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

          {/* TAB: GROUPING (WhatsApp-style Grouping & Communication) */}
          {activeTab === 'grouping' && (
            <GroupingChatView user={user} />
          )}

          {/* TAB: MY PROGRESS (Employee Dashboard: Assigned & Approved Projects, Ratings & Analytics) */}
          {activeTab === 'my_progress' && (
            <MyProgressView user={user} />
          )}

          {/* TAB: INVITES (Admin Employee Panel with Invitations & Account Activation) */}
          {isAdmin && (activeTab === 'invites' || activeTab === 'team') && (
            <AdminEmployeePanel
              companyName={user?.companyName}
              onTestAcceptInvite={onTestAcceptInvite}
            />
          )}

          {/* TAB: SETTINGS (Organization Structure & Permissions Builder or User Profile) */}
          {activeTab === 'settings' && (
            isAdmin ? (
              <OrganizationStructureBuilder
                employees={employees}
                onHierarchyUpdated={refreshAllData}
              />
            ) : (
              <EmployeeProfileView
                user={user}
                isAdmin={isAdmin}
                onProfileUpdated={(updatedUser) => {
                  if (onUpdateUser) onUpdateUser(updatedUser);
                  refreshAllData();
                }}
              />
            )
          )}

          {/* TAB: MESSAGES (Notifications & Meeting Updates) */}
          {activeTab === 'messages' && (
            <div className="messages-center-card animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Taskflow Notifications & Messages</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Track assignments, project updates, milestone events, and system alerts
                  </p>
                </div>
                {unreadNotifCount > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
                    Mark All as Read
                  </button>
                )}
              </div>
              <div className="messages-list">
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>No messages or meeting notifications yet.</p>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={n._id || n.id || i}
                      className={`message-item-card ${!n.read ? 'unread-item' : ''}`}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '12px',
                        background: 'var(--bg-card)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: !n.read ? 'var(--primary-color)' : 'transparent',
                            }}
                          />
                          <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{n.title}</strong>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(n.createdAt || Date.now()).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 12px 16px', color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.5' }}>
                        {n.message}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => handleNotificationClick(n)}
                        >
                          Open Record →
                        </button>
                        {!n.read && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={(e) => handleMarkSingleRead(n._id || n.id, e)}
                          >
                            Mark as Read
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-xs"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#ef4444',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            background: 'transparent',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => handleDeleteNotification(n._id || n.id, e)}
                        >
                          Delete
                        </button>
                      </div>
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

          {/* TAB: AUTOMATED PERFORMANCE EVALUATION & ANALYTICS */}
          {activeTab === 'analytics' && (
            <PerformanceDashboardView
              user={user}
              isAdmin={isAdmin}
              selectedEmployeeId={selectedEmployeeForEval}
              onOpenDirectory={() => setIsDirectoryModalOpen(true)}
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
          </ErrorBoundary>
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
        onConnectForAssistance={handleOpenWorkConnectForTask}
        onOpenNewProject={() => {
          setIsTaskModalOpen(false);
          setEditingProject(null);
          setIsProjectModalOpen(true);
        }}
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

      {/* Complete Employee Directory & Performance Registry Modal */}
      <EmployeeDirectoryModal
        isOpen={isDirectoryModalOpen}
        onClose={() => setIsDirectoryModalOpen(false)}
        onSelectEmployeeForEvaluation={(empId) => {
          setSelectedEmployeeForEval(empId);
          setActiveTab('analytics');
        }}
      />
    </div>
  );
};
