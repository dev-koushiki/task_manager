import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../services/api';
import {
  LifeBuoyIcon,
  HelpCircleIcon,
  PlusIcon,
  SearchIcon,
  FilterIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  UsersIcon,
  UserIcon,
  SendIcon,
  PaperclipIcon,
  MessageSquareIcon,
  ChevronRightIcon,
  XIcon,
  SparklesIcon,
  ShieldIcon,
  RefreshCwIcon,
  TagIcon,
  SlidersIcon,
  TrendingUpIcon,
  FolderIcon,
  FileTextIcon,
  Trash2Icon,
} from './Icons';

export const HelpDeskView = ({
  user,
  tasks = [],
  projects = [],
}) => {
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'director';

  // Active top-level view role: 'employee' | 'department' | 'admin'
  const [activeRoleView, setActiveRoleView] = useState(() => (isAdmin ? 'admin' : isManager ? 'department' : 'employee'));

  // Active sub-tab
  const [subTab, setSubTab] = useState(() => (isAdmin ? 'all' : isManager ? 'dept-assigned' : 'my-tickets'));

  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');

  // Raise Ticket Modal & Form State
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketCategory, setTicketCategory] = useState('');
  const [ticketDepartment, setTicketDepartment] = useState('');
  const [ticketPriority, setTicketPriority] = useState('');
  const [ticketProject, setTicketProject] = useState('');
  const [ticketTask, setTicketTask] = useState('');
  const [attachments, setAttachments] = useState([]);

  // AI 5-Step Animated Submission Overlay State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiAnalysisStep, setAiAnalysisStep] = useState(0); // 1 to 5
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);

  // Ticket Conversation & Workspace State
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [aiAssistanceData, setAiAssistanceData] = useState(null);
  const [isLoadingAiAssist, setIsLoadingAiAssist] = useState(false);
  const chatScrollRef = useRef(null);

  // Reassign Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignDept, setReassignDept] = useState('');
  const [reassignEmployeeId, setReassignEmployeeId] = useState('');
  const [reassignNote, setReassignNote] = useState('');
  const [departmentStaff, setDepartmentStaff] = useState([]);

  // Resolve / Reopen Modals
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Analytics & Settings State
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Categories list
  const categoriesList = [
    'Technical Support',
    'IT and Infrastructure',
    'Human Resources',
    'Finance and Accounts',
    'Administration',
    'Project Management',
    'Attendance and Leave',
    'Employee Management',
    'Software and Application Issues',
    'Other',
  ];

  // Fetch Tickets
  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      let scope = 'all';
      if (activeRoleView === 'employee') scope = 'my';
      else if (activeRoleView === 'department') {
        if (subTab === 'dept-unassigned') scope = 'unassigned';
        else scope = 'department';
      } else if (activeRoleView === 'admin') {
        if (subTab === 'admin-unassigned') scope = 'unassigned';
        else if (subTab === 'admin-escalated') scope = 'escalated';
        else scope = 'all';
      }

      let effStatus = statusFilter;
      if (subTab === 'my-open' || subTab === 'dept-open') effStatus = 'open';
      else if (subTab === 'my-inprogress' || subTab === 'dept-inprogress') effStatus = 'in-progress';
      else if (subTab === 'my-resolved' || subTab === 'dept-resolved') effStatus = 'resolved';
      else if (subTab === 'my-closed') effStatus = 'closed';

      const res = await api.getHelpDeskTickets({
        scope,
        status: effStatus,
        priority: priorityFilter,
        category: categoryFilter,
        department: departmentFilter,
        search: searchQuery,
        timeRange,
      });

      if (res && res.success) {
        setTickets(res.tickets || []);
      }
    } catch (err) {
      console.warn('Failed to load help desk tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeRoleView,
    subTab,
    statusFilter,
    priorityFilter,
    categoryFilter,
    departmentFilter,
    searchQuery,
    timeRange,
  ]);

  // Load Analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await api.getHelpDeskAnalytics({ timeRange });
      if (res && res.success) {
        setAnalytics(res.analytics);
      }
    } catch (err) {
      console.warn('Failed to load analytics:', err);
    }
  }, [timeRange]);

  // Load Settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await api.getHelpDeskSettings();
      if (res && res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (activeRoleView === 'admin' && subTab === 'analytics') {
      loadAnalytics();
    } else if (activeRoleView === 'admin' && subTab === 'settings') {
      loadSettings();
    }
  }, [activeRoleView, subTab, loadAnalytics, loadSettings]);

  // Load Single Ticket Details & Messages
  const handleSelectTicket = async (ticket) => {
    try {
      const res = await api.getHelpDeskTicket(ticket._id);
      if (res && res.success) {
        setSelectedTicket(res.ticket);
        loadMessages(ticket._id);
        setAiAssistanceData(null);
      }
    } catch {
      setSelectedTicket(ticket);
      loadMessages(ticket._id);
    }
  };

  const loadMessages = async (ticketId) => {
    try {
      const res = await api.getTicketMessages(ticketId);
      if (res && res.success) {
        setMessages(res.messages || []);
      }
    } catch (err) {
      console.warn('Could not load ticket messages:', err);
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // AI 5-Step Simulation & Real Submission
  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDescription.trim()) return;

    setIsSubmitting(true);
    setAiAnalysisStep(1);

    // Simulate animated triage stages
    setTimeout(() => setAiAnalysisStep(2), 500);
    setTimeout(() => setAiAnalysisStep(3), 1100);
    setTimeout(() => setAiAnalysisStep(4), 1700);
    setTimeout(() => setAiAnalysisStep(5), 2300);

    try {
      const res = await api.createHelpDeskTicket({
        subject: ticketSubject,
        description: ticketDescription,
        category: ticketCategory || undefined,
        department: ticketDepartment || undefined,
        priority: ticketPriority || undefined,
        relatedProjectId: ticketProject || undefined,
        relatedTaskId: ticketTask || undefined,
        attachments,
      });

      setTimeout(() => {
        setIsSubmitting(false);
        setIsRaiseModalOpen(false);
        setAiAnalysisStep(0);
        // Reset form
        setTicketSubject('');
        setTicketDescription('');
        setTicketCategory('');
        setTicketDepartment('');
        setTicketPriority('');
        setTicketProject('');
        setTicketTask('');
        setAttachments([]);

        if (res && res.success && res.ticket) {
          handleSelectTicket(res.ticket);
          loadTickets();
        }
      }, 3000);
    } catch (err) {
      setIsSubmitting(false);
      setAiAnalysisStep(0);
      alert(`Failed to raise ticket: ${err.message}`);
    }
  };

  // Send Message / Note
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedTicket) return;

    setIsSendingMessage(true);
    try {
      const res = await api.addTicketMessage(selectedTicket._id, {
        message: messageInput.trim(),
        isInternalNote,
      });

      if (res && res.success) {
        setMessages((prev) => [...prev, res.message]);
        setMessageInput('');
      }
    } catch (err) {
      alert(`Could not send message: ${err.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Trigger AI Follow-up Assistance
  const handleFetchAiAssist = async () => {
    if (!selectedTicket) return;
    setIsLoadingAiAssist(true);
    try {
      const res = await api.getHelpDeskAiAssist(selectedTicket._id);
      if (res && res.success && res.followUp) {
        setAiAssistanceData(res.followUp);
      }
    } catch (err) {
      alert(`AI follow-up error: ${err.message}`);
    } finally {
      setIsLoadingAiAssist(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedTicket) return;
    if (newStatus === 'resolved') {
      setIsResolveModalOpen(true);
      return;
    }
    if (newStatus === 'reopened') {
      setIsReopenModalOpen(true);
      return;
    }

    try {
      const res = await api.updateHelpDeskTicketStatus(selectedTicket._id, { status: newStatus });
      if (res && res.success) {
        setSelectedTicket(res.ticket);
        loadTickets();
      }
    } catch (err) {
      alert(`Could not update status: ${err.message}`);
    }
  };

  // Confirm Resolve
  const handleConfirmResolve = async () => {
    if (!selectedTicket) return;
    try {
      const res = await api.updateHelpDeskTicketStatus(selectedTicket._id, {
        status: 'resolved',
        resolutionSummary,
      });
      if (res && res.success) {
        setSelectedTicket(res.ticket);
        setIsResolveModalOpen(false);
        setResolutionSummary('');
        loadTickets();
      }
    } catch (err) {
      alert(`Resolution error: ${err.message}`);
    }
  };

  // Confirm Reopen
  const handleConfirmReopen = async () => {
    if (!selectedTicket) return;
    try {
      const res = await api.updateHelpDeskTicketStatus(selectedTicket._id, {
        status: 'reopened',
        reopenReason,
      });
      if (res && res.success) {
        setSelectedTicket(res.ticket);
        setIsReopenModalOpen(false);
        setReopenReason('');
        loadTickets();
      }
    } catch (err) {
      alert(`Reopen error: ${err.message}`);
    }
  };

  // Open Reassign Modal & Load Staff
  const handleOpenReassignModal = async () => {
    if (!selectedTicket) return;
    setReassignDept(selectedTicket.assignedDepartment || '');
    setReassignEmployeeId(selectedTicket.assignedTo?._id || '');
    setReassignNote('');
    setIsReassignModalOpen(true);

    try {
      const empRes = await api.getEmployees();
      const allEmps = Array.isArray(empRes) ? empRes : empRes?.employees || [];
      setDepartmentStaff(allEmps);
    } catch {
      // ignore
    }
  };

  // Confirm Reassignment
  const handleConfirmReassign = async () => {
    if (!selectedTicket) return;
    try {
      const res = await api.assignHelpDeskTicket(selectedTicket._id, {
        department: reassignDept,
        employeeId: reassignEmployeeId || undefined,
        note: reassignNote,
      });

      if (res && res.success) {
        setSelectedTicket(res.ticket);
        setIsReassignModalOpen(false);
        loadTickets();
      }
    } catch (err) {
      alert(`Reassignment failed: ${err.message}`);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      await api.updateHelpDeskSettings(settings);
      alert('Help Desk settings updated successfully.');
    } catch (err) {
      alert(`Could not save settings: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (st) => {
    const map = {
      submitted: { label: 'Submitted', cls: 'status-submitted' },
      'ai-analyzing': { label: 'AI Triage', cls: 'status-ai' },
      'awaiting-assignment': { label: 'Unassigned', cls: 'status-unassigned' },
      assigned: { label: 'Assigned', cls: 'status-assigned' },
      'in-progress': { label: 'In Progress', cls: 'status-inprogress' },
      'waiting-employee-response': { label: 'Waiting on Employee', cls: 'status-waiting' },
      escalated: { label: 'Escalated', cls: 'status-escalated' },
      resolved: { label: 'Resolved', cls: 'status-resolved' },
      closed: { label: 'Closed', cls: 'status-closed' },
      reopened: { label: 'Reopened', cls: 'status-reopened' },
    };

    const item = map[st] || { label: st, cls: 'status-default' };
    return <span className={`hd-badge ${item.cls}`}>{item.label}</span>;
  };

  // Priority Badge Component
  const renderPriorityBadge = (pr) => {
    const map = {
      critical: { label: 'Critical', cls: 'priority-critical' },
      high: { label: 'High', cls: 'priority-high' },
      medium: { label: 'Medium', cls: 'priority-medium' },
      low: { label: 'Low', cls: 'priority-low' },
    };

    const item = map[pr] || { label: pr, cls: 'priority-medium' };
    return <span className={`hd-priority-badge ${item.cls}`}>{item.label}</span>;
  };

  // Format Date Helper
  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="helpdesk-container animate-fade-in">
      {/* 1. Header Banner & Actions */}
      <div className="helpdesk-header">
        <div className="helpdesk-header-left">
          <div className="helpdesk-title-icon">
            <LifeBuoyIcon size={24} />
          </div>
          <div>
            <h2 className="helpdesk-title">AI-Powered Help Desk & Smart Ticket Management</h2>
            <p className="helpdesk-subtitle">
              Automated issue understanding, intelligent department routing, SLA escalation, and guided resolution.
            </p>
          </div>
        </div>

        <div className="helpdesk-header-right">
          {/* Top Role-View Switcher (if user has permissions) */}
          {(isAdmin || isManager) && (
            <div className="hd-view-switcher">
              <button
                type="button"
                className={`switcher-btn ${activeRoleView === 'employee' ? 'active' : ''}`}
                onClick={() => {
                  setActiveRoleView('employee');
                  setSubTab('my-tickets');
                }}
              >
                Employee View
              </button>
              <button
                type="button"
                className={`switcher-btn ${activeRoleView === 'department' ? 'active' : ''}`}
                onClick={() => {
                  setActiveRoleView('department');
                  setSubTab('dept-assigned');
                }}
              >
                Department View
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`switcher-btn ${activeRoleView === 'admin' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveRoleView('admin');
                    setSubTab('all');
                  }}
                >
                  Admin View
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsRaiseModalOpen(true)}
          >
            <PlusIcon size={16} />
            <span>Raise New Ticket</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-icon-only"
            onClick={loadTickets}
            title="Refresh Tickets"
          >
            <RefreshCwIcon size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs based on Active Role View */}
      <div className="helpdesk-nav-tabs">
        {activeRoleView === 'employee' && (
          <>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'my-tickets' ? 'active' : ''}`}
              onClick={() => setSubTab('my-tickets')}
            >
              My Tickets
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'my-open' ? 'active' : ''}`}
              onClick={() => setSubTab('my-open')}
            >
              Open Tickets
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'my-inprogress' ? 'active' : ''}`}
              onClick={() => setSubTab('my-inprogress')}
            >
              In Progress
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'my-resolved' ? 'active' : ''}`}
              onClick={() => setSubTab('my-resolved')}
            >
              Resolved Tickets
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'my-closed' ? 'active' : ''}`}
              onClick={() => setSubTab('my-closed')}
            >
              Closed Tickets
            </button>
          </>
        )}

        {activeRoleView === 'department' && (
          <>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'dept-assigned' ? 'active' : ''}`}
              onClick={() => setSubTab('dept-assigned')}
            >
              Assigned Tickets
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'dept-unassigned' ? 'active' : ''}`}
              onClick={() => setSubTab('dept-unassigned')}
            >
              Unassigned Queue
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'dept-inprogress' ? 'active' : ''}`}
              onClick={() => setSubTab('dept-inprogress')}
            >
              In Progress
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'dept-escalated' ? 'active' : ''}`}
              onClick={() => setSubTab('dept-escalated')}
            >
              Escalated Tickets
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'dept-resolved' ? 'active' : ''}`}
              onClick={() => setSubTab('dept-resolved')}
            >
              Resolved Tickets
            </button>
          </>
        )}

        {activeRoleView === 'admin' && (
          <>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'all' ? 'active' : ''}`}
              onClick={() => setSubTab('all')}
            >
              All Tickets
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'admin-unassigned' ? 'active' : ''}`}
              onClick={() => setSubTab('admin-unassigned')}
            >
              Unassigned
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'admin-escalated' ? 'active' : ''}`}
              onClick={() => setSubTab('admin-escalated')}
            >
              Escalated
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setSubTab('analytics')}
            >
              <TrendingUpIcon size={14} />
              <span>Ticket Analytics</span>
            </button>
            <button
              type="button"
              className={`hd-tab-btn ${subTab === 'settings' ? 'active' : ''}`}
              onClick={() => setSubTab('settings')}
            >
              <SlidersIcon size={14} />
              <span>Help Desk Settings</span>
            </button>
          </>
        )}
      </div>

      {/* 3. MAIN CONTENT: ANALYTICS VIEW */}
      {subTab === 'analytics' && (
        <div className="tab-pane animate-fade-in space-y-6">
          {analytics ? (
            <>
              <div className="hd-analytics-grid">
                <div className="hd-stat-card">
                  <div className="stat-label">Total Tickets</div>
                  <div className="stat-value">{analytics.totalTickets}</div>
                  <div className="stat-meta">Lifetime across organization</div>
                </div>
                <div className="hd-stat-card">
                  <div className="stat-label">Active Open</div>
                  <div className="stat-value text-blue-500">{analytics.openTickets}</div>
                  <div className="stat-meta">Requiring attention</div>
                </div>
                <div className="hd-stat-card">
                  <div className="stat-label">Resolved / Closed</div>
                  <div className="stat-value text-green-500">{analytics.resolvedTickets}</div>
                  <div className="stat-meta">Successfully completed</div>
                </div>
                <div className="hd-stat-card">
                  <div className="stat-label">Critical Priority</div>
                  <div className="stat-value text-red-500">{analytics.criticalTickets}</div>
                  <div className="stat-meta">High operational impact</div>
                </div>
                <div className="hd-stat-card">
                  <div className="stat-label">SLA Compliance</div>
                  <div className="stat-value text-emerald-500">{analytics.slaCompliancePct}%</div>
                  <div className="stat-meta">Tickets on-time</div>
                </div>
                <div className="hd-stat-card">
                  <div className="stat-label">Avg Resolution Time</div>
                  <div className="stat-value">{analytics.avgResolutionHours}h</div>
                  <div className="stat-meta">First contact to fix</div>
                </div>
              </div>

              {/* Department Volume breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="hd-card-panel">
                  <h4 className="font-semibold text-sm mb-3">Department Ticket Distribution</h4>
                  <div className="space-y-2">
                    {Object.entries(analytics.departmentDistribution || {}).map(([dept, count]) => (
                      <div key={dept} className="flex justify-between items-center text-xs p-2 bg-card-subtle rounded">
                        <span className="font-medium">{dept}</span>
                        <span className="font-bold">{count} tickets</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hd-card-panel">
                  <h4 className="font-semibold text-sm mb-3">Category Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(analytics.categoryDistribution || {}).map(([cat, count]) => (
                      <div key={cat} className="flex justify-between items-center text-xs p-2 bg-card-subtle rounded">
                        <span className="font-medium">{cat}</span>
                        <span className="font-bold">{count} tickets</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-muted text-sm">Loading analytics...</div>
          )}
        </div>
      )}

      {/* 4. MAIN CONTENT: SETTINGS VIEW */}
      {subTab === 'settings' && (
        <div className="tab-pane animate-fade-in">
          <form onSubmit={handleSaveSettings} className="hd-card-panel max-w-3xl space-y-6">
            <div>
              <h3 className="font-bold text-base mb-1">Help Desk & SLA Configuration</h3>
              <p className="text-xs text-muted">
                Configure response and resolution SLA deadlines, escalation thresholds, and automated routing rules.
              </p>
            </div>

            {settings?.slaHours && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">SLA Targets by Priority</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {['critical', 'high', 'medium', 'low'].map((pri) => (
                    <div key={pri} className="p-3 bg-card-subtle rounded-lg border border-border">
                      <div className="font-bold text-xs capitalize mb-2">{pri} Priority</div>
                      <label className="text-[11px] text-muted block mb-1">
                        First Response (hours):
                        <input
                          type="number"
                          step="0.25"
                          value={settings.slaHours[pri]?.responseHours || 1}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              slaHours: {
                                ...settings.slaHours,
                                [pri]: {
                                  ...settings.slaHours[pri],
                                  responseHours: parseFloat(e.target.value) || 1,
                                },
                              },
                            })
                          }
                          className="form-input text-xs w-full mt-1"
                        />
                      </label>

                      <label className="text-[11px] text-muted block mt-2">
                        Resolution (hours):
                        <input
                          type="number"
                          value={settings.slaHours[pri]?.resolutionHours || 24}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              slaHours: {
                                ...settings.slaHours,
                                [pri]: {
                                  ...settings.slaHours[pri],
                                  resolutionHours: parseFloat(e.target.value) || 24,
                                },
                              },
                            })
                          }
                          className="form-input text-xs w-full mt-1"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={isSavingSettings}>
                {isSavingSettings ? 'Saving Settings...' : 'Save Help Desk Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. MAIN CONTENT: TICKETS LIST & WORKSPACE */}
      {subTab !== 'analytics' && subTab !== 'settings' && (
        <div className="helpdesk-workspace-layout">
          {/* Left Column: Tickets Search, Filter, and Cards List */}
          <div className="hd-tickets-sidebar">
            <div className="hd-search-filter-box">
              <div className="hd-search-input-wrapper">
                <SearchIcon size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search tickets by ID, subject, or requester..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="hd-search-input"
                />
              </div>

              <div className="hd-filter-row">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="hd-mini-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Active Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="hd-mini-select"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Ticket Cards Stream */}
            <div className="hd-ticket-cards-list">
              {isLoading ? (
                <div className="p-8 text-center text-muted text-xs">Loading tickets...</div>
              ) : tickets.length === 0 ? (
                <div className="hd-empty-tickets">
                  <LifeBuoyIcon size={36} className="text-muted mb-2" />
                  <h4 className="font-semibold text-sm">No Support Tickets Found</h4>
                  <p className="text-xs text-muted mt-1">
                    {searchQuery ? 'Try adjusting your search query or filters.' : 'Click "Raise New Ticket" above to submit a support request.'}
                  </p>
                </div>
              ) : (
                tickets.map((t) => {
                  const isSelected = selectedTicket?._id === t._id;
                  return (
                    <div
                      key={t._id}
                      className={`hd-ticket-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectTicket(t)}
                    >
                      <div className="hd-card-header">
                        <span className="ticket-id-tag">{t.ticketId}</span>
                        {renderPriorityBadge(t.priority)}
                      </div>

                      <h4 className="hd-card-subject">{t.subject}</h4>
                      <p className="hd-card-desc-preview">{t.description}</p>

                      <div className="hd-card-footer">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <UserIcon size={12} />
                          <span>{t.requesterName || 'Employee'}</span>
                        </div>
                        {renderStatusBadge(t.status)}
                      </div>

                      {t.sla?.isResolutionOverdue && (
                        <div className="hd-sla-breach-badge">
                          <AlertTriangleIcon size={11} />
                          <span>SLA Overdue</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Ticket Detail & Communication Stage */}
          <div className="hd-ticket-detail-panel">
            {selectedTicket ? (
              <div className="hd-detail-container animate-fade-in">
                {/* Detail Header */}
                <div className="hd-detail-top-bar">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-base text-primary">
                      {selectedTicket.ticketId}
                    </span>
                    {renderStatusBadge(selectedTicket.status)}
                    {renderPriorityBadge(selectedTicket.priority)}
                    <span className="hd-dept-pill">{selectedTicket.assignedDepartment}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Management Action Buttons */}
                    {(isAdmin || isManager || selectedTicket.assignedTo?._id === user?._id) && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={handleOpenReassignModal}
                      >
                        Reassign
                      </button>
                    )}

                    {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-success"
                        onClick={() => handleUpdateStatus('resolved')}
                      >
                        <CheckCircleIcon size={14} />
                        <span>Mark Resolved</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => handleUpdateStatus('reopened')}
                      >
                        Reopen Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* Ticket Title & Requester Card */}
                <div className="hd-ticket-hero">
                  <h3 className="hd-hero-subject">{selectedTicket.subject}</h3>
                  <div className="hd-hero-meta">
                    <span>
                      Raised by <strong>{selectedTicket.requesterName}</strong> ({selectedTicket.requesterEmail})
                    </span>
                    <span>&bull;</span>
                    <span>Department: {selectedTicket.requesterDepartment || 'General'}</span>
                    <span>&bull;</span>
                    <span>Submitted {formatDate(selectedTicket.createdAt)}</span>
                  </div>
                  <div className="hd-hero-body">{selectedTicket.description}</div>
                </div>

                {/* AI Problem Analysis Card */}
                {selectedTicket.aiAnalysis && (
                  <div className="hd-ai-card animate-fade-in">
                    <div className="hd-ai-header">
                      <div className="flex items-center gap-2">
                        <SparklesIcon size={16} className="text-amber-400" />
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                          AI Issue Intelligence & Triage
                        </span>
                      </div>
                      <span className="text-[11px] text-muted">
                        Confidence: {Math.round((selectedTicket.aiAnalysis.confidenceScore || 0.9) * 100)}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 mt-2 font-medium">
                      {selectedTicket.aiAnalysis.summary}
                    </p>

                    {selectedTicket.aiAnalysis.suggestedResolution?.length > 0 && (
                      <div className="hd-ai-troubleshooting">
                        <div className="text-[11px] font-semibold text-muted uppercase mb-1">
                          Recommended Troubleshooting Steps:
                        </div>
                        <ul className="text-xs space-y-1 text-slate-300">
                          {selectedTicket.aiAnalysis.suggestedResolution.map((step, idx) => (
                            <li key={idx} className="flex gap-2 items-start">
                              <span className="text-amber-400 font-bold">&bull;</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Conversation & Notes Panel */}
                <div className="hd-conversation-box">
                  <div className="hd-conv-header">
                    <div className="flex items-center gap-2">
                      <MessageSquareIcon size={16} />
                      <span className="font-semibold text-sm">Ticket Conversation</span>
                    </div>

                    {(isAdmin || isManager || selectedTicket.assignedTo?._id === user?._id) && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline flex items-center gap-1.5"
                        onClick={handleFetchAiAssist}
                        disabled={isLoadingAiAssist}
                      >
                        <SparklesIcon size={13} className="text-amber-400" />
                        <span>{isLoadingAiAssist ? 'Consulting AI...' : 'AI Response Suggestion'}</span>
                      </button>
                    )}
                  </div>

                  {/* AI Follow-up Recommendation Callout */}
                  {aiAssistanceData && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-2 animate-fade-in">
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <SparklesIcon size={13} />
                        <span>Suggested Reply for Support:</span>
                      </div>
                      <p className="text-slate-300">{aiAssistanceData.suggestedReply}</p>
                      <button
                        type="button"
                        className="btn btn-xs btn-secondary"
                        onClick={() => setMessageInput(aiAssistanceData.suggestedReply)}
                      >
                        Insert into Composer
                      </button>
                    </div>
                  )}

                  {/* Messages Feed */}
                  <div className="hd-messages-feed" ref={chatScrollRef}>
                    {messages.length === 0 ? (
                      <div className="text-center p-6 text-muted text-xs">
                        No replies yet. Communicate directly with the requester below.
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isMine = m.sender?._id === user?._id;
                        return (
                          <div
                            key={m._id}
                            className={`hd-message-bubble ${isMine ? 'mine' : 'theirs'} ${m.isInternalNote ? 'internal-note' : ''}`}
                          >
                            <div className="hd-msg-header">
                              <span className="font-semibold">{m.senderName}</span>
                              {m.isInternalNote && <span className="internal-badge">INTERNAL NOTE</span>}
                              <span className="hd-msg-time">{formatDate(m.createdAt)}</span>
                            </div>
                            <div className="hd-msg-body">{m.message}</div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Message Composer */}
                  <form onSubmit={handleSendMessage} className="hd-composer-bar">
                    {(isAdmin || isManager || selectedTicket.assignedTo?._id === user?._id) && (
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="checkbox-custom"
                        />
                        <span className={isInternalNote ? 'text-amber-400 font-semibold' : ''}>
                          Post as Internal Department Note (hidden from requester)
                        </span>
                      </label>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={isInternalNote ? 'Type an internal note for staff...' : 'Reply to employee...'}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className={`hd-msg-input ${isInternalNote ? 'internal-mode' : ''}`}
                      />
                      <button type="submit" className="btn btn-primary" disabled={isSendingMessage || !messageInput.trim()}>
                        <SendIcon size={14} />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="hd-no-selection">
                <LifeBuoyIcon size={48} className="text-muted mb-3" />
                <h3 className="font-bold text-base">Select a Ticket to View Details</h3>
                <p className="text-xs text-muted max-w-sm mt-1">
                  Choose a ticket from the left list to review its AI analysis, communicate with staff, update statuses, or track SLAs.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL: RAISE NEW TICKET */}
      {isRaiseModalOpen && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <LifeBuoyIcon size={20} className="text-primary" />
                <h3 className="modal-title">Raise Support Ticket</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => !isSubmitting && setIsRaiseModalOpen(false)}
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* AI 5-Step Progress Overlay during submission */}
            {isSubmitting ? (
              <div className="p-8 text-center space-y-6">
                <div className="ai-pulse-circle">
                  <SparklesIcon size={32} className="text-amber-400 animate-spin-slow" />
                </div>
                <div>
                  <h4 className="font-bold text-base mb-1">Smart AI Issue Analysis</h4>
                  <p className="text-xs text-muted">
                    Our AI assistant is diagnosing your problem and routing it to the best department.
                  </p>
                </div>

                <div className="space-y-3 text-left max-w-xs mx-auto">
                  <div className={`ai-step-row ${aiAnalysisStep >= 1 ? 'completed' : ''}`}>
                    <span className="step-num">1</span>
                    <span className="text-xs">Understanding your problem</span>
                  </div>
                  <div className={`ai-step-row ${aiAnalysisStep >= 2 ? 'completed' : ''}`}>
                    <span className="step-num">2</span>
                    <span className="text-xs">Identifying category</span>
                  </div>
                  <div className={`ai-step-row ${aiAnalysisStep >= 3 ? 'completed' : ''}`}>
                    <span className="step-num">3</span>
                    <span className="text-xs">Detecting responsible department</span>
                  </div>
                  <div className={`ai-step-row ${aiAnalysisStep >= 4 ? 'completed' : ''}`}>
                    <span className="step-num">4</span>
                    <span className="text-xs">Evaluating priority & SLA</span>
                  </div>
                  <div className={`ai-step-row ${aiAnalysisStep >= 5 ? 'completed' : ''}`}>
                    <span className="step-num">5</span>
                    <span className="text-xs">Auto-assigning support specialist</span>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket}>
                <div className="modal-body space-y-4">
                  <p className="text-xs text-muted">
                    Describe your problem in your own words. Our AI will automatically categorize and route it to the right department.
                  </p>

                  <div>
                    <label className="label-text text-xs font-semibold block mb-1">
                      Ticket Subject *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cannot connect to staging database via VPN"
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      className="form-input text-xs w-full"
                      required
                    />
                  </div>

                  <div>
                    <label className="label-text text-xs font-semibold block mb-1">
                      Problem Description *
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Provide full details: what happened, error messages, and operational impact..."
                      value={ticketDescription}
                      onChange={(e) => setTicketDescription(e.target.value)}
                      className="form-textarea text-xs w-full"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text text-xs font-semibold block mb-1">
                        Category (Optional)
                      </label>
                      <select
                        value={ticketCategory}
                        onChange={(e) => setTicketCategory(e.target.value)}
                        className="form-select text-xs w-full"
                      >
                        <option value="">AI Auto-Detect</option>
                        {categoriesList.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label-text text-xs font-semibold block mb-1">
                        Priority (Optional)
                      </label>
                      <select
                        value={ticketPriority}
                        onChange={(e) => setTicketPriority(e.target.value)}
                        className="form-select text-xs w-full"
                      >
                        <option value="">AI Auto-Evaluate</option>
                        <option value="critical">Critical (System Outage)</option>
                        <option value="high">High (Blocked Work)</option>
                        <option value="medium">Medium (Standard)</option>
                        <option value="low">Low (General Query)</option>
                      </select>
                    </div>
                  </div>

                  {tasks.length > 0 && (
                    <div>
                      <label className="label-text text-xs font-semibold block mb-1">
                        Related Task (Optional)
                      </label>
                      <select
                        value={ticketTask}
                        onChange={(e) => setTicketTask(e.target.value)}
                        className="form-select text-xs w-full"
                      >
                        <option value="">-- No specific task --</option>
                        {tasks.map((t) => (
                          <option key={t._id} value={t._id}>{t.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsRaiseModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!ticketSubject.trim() || !ticketDescription.trim()}
                  >
                    <SparklesIcon size={15} />
                    <span>Analyze & Submit Ticket</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 7. MODAL: REASSIGN TICKET */}
      {isReassignModalOpen && selectedTicket && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Reassign Ticket {selectedTicket.ticketId}</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setIsReassignModalOpen(false)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label-text text-xs font-semibold block mb-1">
                  Target Department
                </label>
                <input
                  type="text"
                  value={reassignDept}
                  onChange={(e) => setReassignDept(e.target.value)}
                  className="form-input text-xs w-full"
                  placeholder="e.g. IT, Engineering, HR, Finance..."
                />
              </div>

              <div>
                <label className="label-text text-xs font-semibold block mb-1">
                  Assign to Specialist (Optional)
                </label>
                <select
                  value={reassignEmployeeId}
                  onChange={(e) => setReassignEmployeeId(e.target.value)}
                  className="form-select text-xs w-full"
                >
                  <option value="">Department Queue (Unassigned)</option>
                  {departmentStaff.map((emp) => (
                    <option key={emp._id || emp.id} value={emp._id || emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.department} - {emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-text text-xs font-semibold block mb-1">
                  Transfer Note
                </label>
                <textarea
                  rows={2}
                  value={reassignNote}
                  onChange={(e) => setReassignNote(e.target.value)}
                  placeholder="Reason for reassignment..."
                  className="form-textarea text-xs w-full"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReassignModalOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmReassign}>
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: RESOLVE TICKET */}
      {isResolveModalOpen && selectedTicket && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Resolve Ticket {selectedTicket.ticketId}</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setIsResolveModalOpen(false)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-xs text-muted">
                Please provide a brief summary of how the problem was resolved for the requester.
              </p>
              <div>
                <label className="label-text text-xs font-semibold block mb-1">
                  Resolution Notes *
                </label>
                <textarea
                  rows={3}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="e.g. Reset VPN credentials and cleared expired auth cache."
                  className="form-textarea text-xs w-full"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsResolveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleConfirmResolve}
                disabled={!resolutionSummary.trim()}
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: REOPEN TICKET */}
      {isReopenModalOpen && selectedTicket && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Reopen Ticket {selectedTicket.ticketId}</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setIsReopenModalOpen(false)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-xs text-muted">
                State the reason why the problem is still unresolved.
              </p>
              <div>
                <label className="label-text text-xs font-semibold block mb-1">
                  Reopen Reason *
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Issue recurred when attempting to log in this morning."
                  className="form-textarea text-xs w-full"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReopenModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmReopen}
                disabled={!reopenReason.trim()}
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpDeskView;
