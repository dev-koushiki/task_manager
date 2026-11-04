import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { workConnectService } from '../services/workConnectService';
import { WorkConnectWorkspace } from './WorkConnectWorkspace';
import {
  MonitorIcon,
  UsersIcon,
  SearchIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  FileTextIcon,
  FilterIcon,
  RefreshCwIcon,
  CalendarIcon,
  ActivityIcon,
  ShieldIcon,
  ChevronRightIcon,
  CheckSquareIcon,
  FolderIcon,
  ExternalLinkIcon,
} from './Icons';

export const WorkConnectView = ({
  user,
  tasks = [],
  projects = [],
  preselectedTaskId = null,
}) => {
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'incoming' | 'active' | 'my-connections' | 'history'
  const [employees, setEmployees] = useState([]);
  const [frequentConnections, setFrequentConnections] = useState([]);
  const [reportingPeers, setReportingPeers] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [historySessions, setHistorySessions] = useState([]);
  const [historyAnalytics, setHistoryAnalytics] = useState(null);
  const [currentLiveSession, setCurrentLiveSession] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [myStatus, setMyStatus] = useState(user?.workConnectStatus || 'online');
  const [isLoading, setIsLoading] = useState(false);

  // Connection Request Modal
  const [selectedTargetEmployee, setSelectedTargetEmployee] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [attachedTaskId, setAttachedTaskId] = useState(preselectedTaskId || '');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  // Assistance Summary Detail Modal
  const [viewSummarySession, setViewSummarySession] = useState(null);

  // Initialize Socket and listeners
  useEffect(() => {
    workConnectService.initSocket(user);

    const unsubIncoming = workConnectService.on('incoming_request', (req) => {
      setIncomingRequests((prev) => [req, ...prev.filter((r) => r._id !== req._id)]);
      // Also show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`WorkConnect Request from ${req.requester?.firstName || 'Colleague'}`, {
          body: req.requestReason || 'Requested remote collaboration assistance.',
        });
      }
    });

    const unsubAccepted = workConnectService.on('request_accepted', (session) => {
      setCurrentLiveSession(session);
      loadActiveSessions();
    });

    const unsubStatus = workConnectService.on('status_update', (data) => {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp._id === data.userId ? { ...emp, workConnectStatus: data.status } : emp
        )
      );
    });

    return () => {
      unsubIncoming();
      unsubAccepted();
      unsubStatus();
    };
  }, [user]);

  // Handle preselected task passed from TaskModal
  useEffect(() => {
    if (preselectedTaskId) {
      setAttachedTaskId(preselectedTaskId);
      setActiveTab('connect');
    }
  }, [preselectedTaskId]);

  // Load All Tab Data
  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.getWorkConnectEmployees({
        search: searchQuery,
        department: departmentFilter !== 'all' ? departmentFilter : '',
        status: statusFilter !== 'all' ? statusFilter : '',
      });
      if (res && res.success) {
        setEmployees(res.employees || []);
      }
    } catch (err) {
      console.warn('Error loading employees:', err);
    }
  }, [searchQuery, departmentFilter, statusFilter]);

  const loadIncoming = useCallback(async () => {
    try {
      const res = await api.getIncomingWorkConnectRequests();
      if (res && res.success) {
        setIncomingRequests(res.incomingRequests || []);
      }
    } catch (err) {
      console.warn('Error loading incoming requests:', err);
    }
  }, []);

  const loadOutgoing = useCallback(async () => {
    try {
      const res = await api.getOutgoingWorkConnectRequests();
      if (res && res.success) {
        setOutgoingRequests(res.outgoingRequests || []);
      }
    } catch (err) {
      console.warn('Error loading outgoing requests:', err);
    }
  }, []);

  const loadActiveSessions = useCallback(async () => {
    try {
      const res = await api.getActiveWorkConnectSessions();
      if (res && res.success) {
        setActiveSessions(res.activeSessions || []);
      }
    } catch (err) {
      console.warn('Error loading active sessions:', err);
    }
  }, []);

  const loadFrequentConnections = useCallback(async () => {
    try {
      const res = await api.getFrequentWorkConnectConnections();
      if (res && res.success) {
        setFrequentConnections(res.frequentConnections || []);
        setReportingPeers(res.reportingPeers || []);
      }
    } catch (err) {
      console.warn('Error loading frequent connections:', err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.getWorkConnectHistory({
        status: historyStatusFilter !== 'all' ? historyStatusFilter : '',
      });
      if (res && res.success) {
        setHistorySessions(res.history || []);
        setHistoryAnalytics(res.analytics || null);
      }
    } catch (err) {
      console.warn('Error loading history:', err);
    }
  }, [historyStatusFilter]);

  // Refresh data based on active tab
  const refreshCurrentView = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadIncoming(),
        loadActiveSessions(),
        activeTab === 'connect' && loadEmployees(),
        activeTab === 'incoming' && loadOutgoing(),
        activeTab === 'my-connections' && loadFrequentConnections(),
        activeTab === 'history' && loadHistory(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    loadIncoming,
    loadActiveSessions,
    loadEmployees,
    loadOutgoing,
    loadFrequentConnections,
    loadHistory,
  ]);

  useEffect(() => {
    refreshCurrentView();
  }, [refreshCurrentView]);

  // Handle Availability Status Change
  const handleChangeStatus = async (newStatus) => {
    setMyStatus(newStatus);
    try {
      await api.updateWorkConnectStatus(newStatus);
    } catch (err) {
      console.warn('Could not update status on server:', err);
    }
  };

  // Open Request Modal for employee
  const handleOpenRequestModal = (emp) => {
    setSelectedTargetEmployee(emp);
    setRequestReason('');
    setRequestModalOpen(true);
  };

  // Send Connection Request
  const handleSubmitConnectionRequest = async (e) => {
    e.preventDefault();
    if (!selectedTargetEmployee) return;

    setIsSubmittingRequest(true);
    try {
      const res = await api.requestWorkConnectConnection({
        receiverId: selectedTargetEmployee._id,
        requestReason,
        attachedTaskId: attachedTaskId || null,
      });

      if (res && res.success) {
        setRequestModalOpen(false);
        setActiveTab('incoming');
        loadOutgoing();
        alert(`Connection request sent to ${selectedTargetEmployee.firstName}!`);
      }
    } catch (err) {
      alert(`Could not send request: ${err.message}`);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Accept Connection Request
  const handleAcceptRequest = async (requestId) => {
    try {
      const res = await api.acceptWorkConnectRequest(requestId);
      if (res && res.success) {
        setCurrentLiveSession(res.session);
        loadActiveSessions();
        loadIncoming();
      }
    } catch (err) {
      alert(`Could not accept request: ${err.message}`);
    }
  };

  // Reject Connection Request
  const handleRejectRequest = async (requestId) => {
    const reason = prompt('Optional rejection note:');
    try {
      await api.rejectWorkConnectRequest(requestId, reason || '');
      loadIncoming();
    } catch (err) {
      alert(`Could not reject request: ${err.message}`);
    }
  };

  // Cancel Outgoing Request
  const handleCancelOutgoing = async (requestId) => {
    try {
      await api.cancelWorkConnectRequest(requestId);
      loadOutgoing();
    } catch (err) {
      alert(`Could not cancel request: ${err.message}`);
    }
  };

  // Status Chip Renderer
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'online':
        return <span className="status-pill status-online">● Online</span>;
      case 'in-session':
        return <span className="status-pill status-in-session">● In Session</span>;
      case 'busy':
        return <span className="status-pill status-busy">● Busy</span>;
      case 'dnd':
        return <span className="status-pill status-dnd">● Do Not Disturb</span>;
      case 'offline':
      default:
        return <span className="status-pill status-offline">○ Offline</span>;
    }
  };

  // If inside a live session workspace, render full-screen workspace
  if (currentLiveSession) {
    return (
      <WorkConnectWorkspace
        session={currentLiveSession}
        currentUser={user}
        onLeaveSession={() => {
          setCurrentLiveSession(null);
          refreshCurrentView();
        }}
        onSessionEnded={() => {
          setCurrentLiveSession(null);
          setActiveTab('history');
          refreshCurrentView();
        }}
      />
    );
  }

  return (
    <div className="workconnect-container animate-fade-in">
      {/* 1. Header Banner & Availability Controls */}
      <div className="workconnect-header">
        <div className="workconnect-header-left">
          <div className="flex items-center gap-3">
            <div className="workconnect-title-icon">
              <MonitorIcon size={24} />
            </div>
            <div>
              <h2 className="workconnect-title">WorkConnect Remote Assistance</h2>
              <p className="workconnect-subtitle">
                Independent real-time screen collaboration, voice, video, and live annotations for authorized colleagues.
              </p>
            </div>
          </div>
        </div>

        <div className="workconnect-header-right">
          {/* User Availability Status Selector */}
          <div className="status-selector-box">
            <span className="text-xs text-muted font-medium">My Availability:</span>
            <select
              value={myStatus}
              onChange={(e) => handleChangeStatus(e.target.value)}
              className="status-dropdown text-xs font-semibold"
            >
              <option value="online">🟢 Online</option>
              <option value="busy">🟡 Busy</option>
              <option value="in-session">🔵 In Session</option>
              <option value="dnd">🔴 Do Not Disturb</option>
              <option value="offline">⚪ Offline</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refreshCurrentView}
            title="Refresh All"
          >
            <RefreshCwIcon size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Incoming Requests Alert Banner (if pending) */}
      {incomingRequests.length > 0 && activeTab !== 'incoming' && (
        <div className="incoming-alert-banner animate-fade-in" onClick={() => setActiveTab('incoming')}>
          <div className="flex items-center gap-2">
            <span className="live-pulse-dot" />
            <span className="font-semibold text-xs text-amber-300">
              You have {incomingRequests.length} pending remote connection request{incomingRequests.length > 1 ? 's' : ''}!
            </span>
          </div>
          <button type="button" className="btn btn-xs btn-primary">
            Review Requests
          </button>
        </div>
      )}

      {/* 2. Top Sub-Navigation Tabs */}
      <div className="workconnect-nav-tabs">
        <button
          type="button"
          className={`wc-tab-btn ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => setActiveTab('connect')}
        >
          <SearchIcon size={15} />
          <span>Connect with Employee</span>
        </button>

        <button
          type="button"
          className={`wc-tab-btn ${activeTab === 'incoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          <PhoneCallIcon size={15} />
          <span>Connection Requests</span>
          {incomingRequests.length > 0 && (
            <span className="badge-count">{incomingRequests.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`wc-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <ActivityIcon size={15} />
          <span>Active Connections</span>
          {activeSessions.length > 0 && (
            <span className="badge-count green">{activeSessions.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`wc-tab-btn ${activeTab === 'my-connections' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-connections')}
        >
          <UsersIcon size={15} />
          <span>My Connections</span>
        </button>

        <button
          type="button"
          className={`wc-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <ClockIcon size={15} />
          <span>Connection History</span>
        </button>
      </div>

      {/* 3. TAB 1: CONNECT WITH EMPLOYEE */}
      {activeTab === 'connect' && (
        <div className="tab-pane animate-fade-in">
          {/* Search & Filter Bar */}
          <div className="wc-filter-bar">
            <div className="wc-search-input-wrapper">
              <SearchIcon size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search colleagues by name, designation, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wc-search-input"
              />
            </div>

            <div className="wc-filter-selects">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="wc-filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="online">Online Only</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          {/* Employee Directory Cards Grid */}
          <div className="employee-cards-grid">
            {employees.length === 0 ? (
              <div className="wc-empty-card col-span-full">
                <UsersIcon size={40} className="text-muted mb-2" />
                <h4 className="font-semibold text-sm">No Colleagues Found</h4>
                <p className="text-xs text-muted">Try adjusting your search query or status filter.</p>
              </div>
            ) : (
              employees.map((emp) => {
                const isOnline = emp.workConnectStatus === 'online';
                const isBusy = emp.workConnectStatus === 'busy' || emp.workConnectStatus === 'in-session';
                return (
                  <div key={emp._id} className="employee-connect-card">
                    <div className="card-top">
                      <div className="avatar-wrapper">
                        <div className="avatar-circle">
                          {emp.firstName?.charAt(0) || 'E'}
                        </div>
                        <span className={`avatar-status-dot dot-${emp.workConnectStatus || 'offline'}`} />
                      </div>
                      <div className="emp-info">
                        <h4 className="emp-name">{emp.firstName} {emp.lastName}</h4>
                        <div className="emp-role">{emp.designation || emp.role || 'Employee'}</div>
                        <div className="emp-dept">{emp.department || 'General'}</div>
                      </div>
                    </div>

                    <div className="card-middle">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">Status:</span>
                        {renderStatusBadge(emp.workConnectStatus)}
                      </div>
                      {emp.relationship && (
                        <div className="relationship-tag">
                          {emp.relationship === 'supervisor' ? 'Reporting Supervisor' :
                           emp.relationship === 'subordinate' ? 'Direct Subordinate' : 'Department Peer'}
                        </div>
                      )}
                    </div>

                    <div className="card-bottom">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-full"
                        onClick={() => handleOpenRequestModal(emp)}
                        disabled={emp.workConnectStatus === 'dnd'}
                      >
                        <PhoneCallIcon size={14} />
                        <span>Request Connection</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: INCOMING & OUTGOING CONNECTION REQUESTS */}
      {activeTab === 'incoming' && (
        <div className="tab-pane animate-fade-in space-y-6">
          {/* Incoming Requests Section */}
          <div className="wc-section-block">
            <div className="section-header">
              <h3 className="section-title">
                Incoming Requests ({incomingRequests.length})
              </h3>
              <p className="section-desc">Colleagues requesting remote assistance or live collaboration with you.</p>
            </div>

            {incomingRequests.length === 0 ? (
              <div className="wc-empty-card">
                <CheckCircleIcon size={36} className="text-success mb-2" />
                <h4 className="font-semibold text-sm">No Pending Incoming Requests</h4>
                <p className="text-xs text-muted">When a colleague requests a connection, it will appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div key={req._id} className="request-card incoming animate-fade-in">
                    <div className="request-card-left">
                      <div className="avatar-circle">
                        {req.requester?.firstName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          {req.requester?.firstName} {req.requester?.lastName}
                        </div>
                        <div className="text-xs text-muted">
                          {req.requester?.designation || req.requester?.role} &bull; {req.requester?.department}
                        </div>
                        {req.requestReason && (
                          <div className="request-reason-quote">
                            "{req.requestReason}"
                          </div>
                        )}
                        {req.attachedTask && (
                          <div className="attached-task-pill">
                            <FileTextIcon size={12} />
                            <span>Attached Task: <strong>{req.attachedTask.title}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="request-card-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={() => handleAcceptRequest(req._id)}
                      >
                        <CheckCircleIcon size={15} />
                        <span>Accept & Connect</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger-outline"
                        onClick={() => handleRejectRequest(req._id)}
                      >
                        <XCircleIcon size={15} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests Section */}
          <div className="wc-section-block">
            <div className="section-header">
              <h3 className="section-title">
                Outgoing Requests Sent by You ({outgoingRequests.length})
              </h3>
              <p className="section-desc">Requests you sent that are currently waiting for acceptance.</p>
            </div>

            {outgoingRequests.length === 0 ? (
              <div className="wc-empty-card">
                <ClockIcon size={36} className="text-muted mb-2" />
                <h4 className="font-semibold text-sm">No Active Outgoing Requests</h4>
                <p className="text-xs text-muted">Go to "Connect with Employee" to initiate a collaboration session.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {outgoingRequests.map((req) => (
                  <div key={req._id} className="request-card outgoing">
                    <div className="request-card-left">
                      <div className="avatar-circle">
                        {req.receiver?.firstName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          To: {req.receiver?.firstName} {req.receiver?.lastName}
                        </div>
                        <div className="text-xs text-muted">
                          {req.receiver?.designation} &bull; Sent {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {req.requestReason && (
                          <div className="text-xs text-muted mt-1">Reason: {req.requestReason}</div>
                        )}
                      </div>
                    </div>

                    <div className="request-card-actions">
                      <span className="status-pill status-busy animate-pulse">Waiting for Response...</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleCancelOutgoing(req._id)}
                      >
                        Cancel Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 3: ACTIVE CONNECTIONS */}
      {activeTab === 'active' && (
        <div className="tab-pane animate-fade-in">
          <div className="section-header">
            <h3 className="section-title">Active Assistance Sessions</h3>
            <p className="section-desc">Currently ongoing remote collaboration sessions in your workspace.</p>
          </div>

          {activeSessions.length === 0 ? (
            <div className="wc-empty-card">
              <ActivityIcon size={40} className="text-muted mb-2" />
              <h4 className="font-semibold text-sm">No Active Collaboration Sessions</h4>
              <p className="text-xs text-muted">
                You are not currently in an active session. Request a connection from the employee directory to get started.
              </p>
            </div>
          ) : (
            <div className="active-sessions-grid">
              {activeSessions.map((sess) => {
                const isRequester = sess.requester?._id === user?._id;
                const peer = isRequester ? sess.receiver : sess.requester;
                return (
                  <div key={sess._id} className="active-session-card">
                    <div className="card-header">
                      <div className="flex items-center gap-2">
                        <span className="live-pulse-dot" />
                        <span className="font-bold text-xs uppercase text-success">Live Session</span>
                      </div>
                      <span className="font-mono text-xs text-muted">{sess.sessionId}</span>
                    </div>

                    <div className="card-body">
                      <div className="peer-row">
                        <div className="avatar-circle">
                          {peer?.firstName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{peer?.firstName} {peer?.lastName}</h4>
                          <div className="text-xs text-muted">{peer?.designation || peer?.role}</div>
                        </div>
                      </div>

                      {sess.attachedTask && (
                        <div className="attached-task-pill mt-3">
                          <FileTextIcon size={12} />
                          <span className="truncate">Task: {sess.attachedTask.title}</span>
                        </div>
                      )}

                      <div className="meta-stats mt-3">
                        <div className="text-xs text-muted">
                          Started: {new Date(sess.startedAt || sess.createdAt).toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-muted">
                          Screen Share: {sess.screenSharing?.active ? 'Active' : 'Off'}
                        </div>
                      </div>
                    </div>

                    <div className="card-footer">
                      <button
                        type="button"
                        className="btn btn-primary w-full"
                        onClick={() => setCurrentLiveSession(sess)}
                      >
                        <MonitorIcon size={16} />
                        <span>Enter Collaboration Workspace</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 4: MY CONNECTIONS (Reporting Hierarchy & Frequent) */}
      {activeTab === 'my-connections' && (
        <div className="tab-pane animate-fade-in space-y-6">
          <div className="wc-section-block">
            <div className="section-header">
              <h3 className="section-title">Organizational Reporting Hierarchy</h3>
              <p className="section-desc">Supervisors and subordinates linked directly to your organizational chain.</p>
            </div>

            <div className="employee-cards-grid">
              {reportingPeers.length === 0 ? (
                <div className="wc-empty-card col-span-full">
                  <p className="text-xs text-muted">No reporting colleagues found in your immediate hierarchy.</p>
                </div>
              ) : (
                reportingPeers.map((emp) => (
                  <div key={emp._id} className="employee-connect-card">
                    <div className="card-top">
                      <div className="avatar-circle">{emp.firstName?.charAt(0) || 'U'}</div>
                      <div className="emp-info">
                        <h4 className="emp-name">{emp.firstName} {emp.lastName}</h4>
                        <div className="emp-role">{emp.designation || emp.role}</div>
                        <div className="relationship-tag">{emp.relationshipTitle}</div>
                      </div>
                    </div>
                    <div className="card-middle">
                      {renderStatusBadge(emp.workConnectStatus)}
                    </div>
                    <div className="card-bottom">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-full"
                        onClick={() => handleOpenRequestModal(emp)}
                      >
                        <PhoneCallIcon size={14} />
                        <span>Quick Connect</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="wc-section-block">
            <div className="section-header">
              <h3 className="section-title">Frequent Collaborators</h3>
              <p className="section-desc">Colleagues you've recently assisted or collaborated with in WorkConnect.</p>
            </div>

            <div className="employee-cards-grid">
              {frequentConnections.length === 0 ? (
                <div className="wc-empty-card col-span-full">
                  <p className="text-xs text-muted">No frequent connections yet. Connect with colleagues to build your history.</p>
                </div>
              ) : (
                frequentConnections.map((conn) => (
                  <div key={conn._id} className="employee-connect-card">
                    <div className="card-top">
                      <div className="avatar-circle">{conn.firstName?.charAt(0) || 'U'}</div>
                      <div className="emp-info">
                        <h4 className="emp-name">{conn.firstName} {conn.lastName}</h4>
                        <div className="emp-role">{conn.designation || conn.role}</div>
                        <div className="text-[11px] text-muted">{conn.sessionCount} sessions completed</div>
                      </div>
                    </div>
                    <div className="card-middle">
                      {renderStatusBadge(conn.workConnectStatus)}
                    </div>
                    <div className="card-bottom">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm w-full"
                        onClick={() => handleOpenRequestModal(conn)}
                      >
                        <PhoneCallIcon size={14} />
                        <span>Connect Again</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 5: CONNECTION HISTORY & ANALYTICS */}
      {activeTab === 'history' && (
        <div className="tab-pane animate-fade-in space-y-6">
          {/* Analytics Cards */}
          {historyAnalytics && (
            <div className="history-analytics-grid">
              <div className="history-stat-card">
                <div className="stat-label">Total Sessions</div>
                <div className="stat-value">{historyAnalytics.totalSessions || 0}</div>
                <div className="stat-meta">Completed collaborations</div>
              </div>
              <div className="history-stat-card">
                <div className="stat-label">Total Time Collaborated</div>
                <div className="stat-value">{historyAnalytics.totalMinutes || 0} min</div>
                <div className="stat-meta">Remote assistance duration</div>
              </div>
              <div className="history-stat-card">
                <div className="stat-label">Screen Share Sessions</div>
                <div className="stat-value">{historyAnalytics.screenSharingSessions || 0}</div>
                <div className="stat-meta">Visual problem solving</div>
              </div>
              <div className="history-stat-card">
                <div className="stat-label">Voice / Video Sessions</div>
                <div className="stat-value">{historyAnalytics.voiceVideoSessions || 0}</div>
                <div className="stat-meta">Direct voice/cam calls</div>
              </div>
            </div>
          )}

          {/* History Filters */}
          <div className="wc-filter-bar">
            <div className="wc-filter-selects">
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="wc-filter-select"
              >
                <option value="all">All Session Statuses</option>
                <option value="completed">Completed Only</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* History Sessions Table */}
          <div className="history-table-wrapper">
            {historySessions.length === 0 ? (
              <div className="wc-empty-card">
                <ClockIcon size={40} className="text-muted mb-2" />
                <h4 className="font-semibold text-sm">No History Records Found</h4>
                <p className="text-xs text-muted">Completed remote assistance sessions will be archived here.</p>
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Participants</th>
                    <th>Attached Task</th>
                    <th>Duration</th>
                    <th>Date & Time</th>
                    <th>Features Used</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historySessions.map((sess) => {
                    const isRequester = sess.requester?._id === user?._id;
                    const peer = isRequester ? sess.receiver : sess.requester;
                    return (
                      <tr key={sess._id}>
                        <td className="font-mono text-xs font-semibold">{sess.sessionId}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                              {peer?.firstName?.charAt(0) || 'U'}
                            </div>
                            <div className="text-xs font-medium">
                              {peer?.firstName} {peer?.lastName}
                            </div>
                          </div>
                        </td>
                        <td>
                          {sess.attachedTask ? (
                            <span className="text-xs text-primary font-medium truncate max-w-[180px] inline-block">
                              {sess.attachedTask.title}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">General</span>
                          )}
                        </td>
                        <td className="text-xs font-mono">
                          {sess.durationSeconds ? `${Math.floor(sess.durationSeconds / 60)}m ${sess.durationSeconds % 60}s` : '—'}
                        </td>
                        <td className="text-xs text-muted">
                          {new Date(sess.createdAt).toLocaleDateString()} {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {sess.screenSharing?.active && <span className="feature-chip" title="Screen Shared">Screen</span>}
                            {sess.voiceUsed && <span className="feature-chip" title="Voice Used">Voice</span>}
                            {sess.videoUsed && <span className="feature-chip" title="Video Used">Video</span>}
                            {sess.annotationsCount > 0 && <span className="feature-chip" title="Annotations">Annotated</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${sess.status === 'completed' ? 'status-online' : 'status-offline'}`}>
                            {sess.status}
                          </span>
                        </td>
                        <td>
                          {sess.assistanceSummary && (
                            <button
                              type="button"
                              className="btn btn-xs btn-outline"
                              onClick={() => setViewSummarySession(sess)}
                            >
                              View Summary
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Request Connection Modal */}
      {requestModalOpen && selectedTargetEmployee && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <PhoneCallIcon size={18} className="text-primary" />
                <h3 className="modal-title">Request WorkConnect Connection</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setRequestModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitConnectionRequest}>
              <div className="modal-body space-y-4">
                {/* Target Colleague Card */}
                <div className="p-3 bg-card-subtle rounded-lg flex items-center gap-3">
                  <div className="avatar-circle">
                    {selectedTargetEmployee.firstName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {selectedTargetEmployee.firstName} {selectedTargetEmployee.lastName}
                    </div>
                    <div className="text-xs text-muted">
                      {selectedTargetEmployee.designation || selectedTargetEmployee.role} &bull; {selectedTargetEmployee.department}
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="label-text text-xs font-semibold block mb-1">
                    Reason for Connection / Assistance Needed:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe what you'd like to collaborate on..."
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="form-textarea w-full text-xs"
                    required
                  />
                </div>

                {/* Attach Task Option */}
                <div>
                  <label className="label-text text-xs font-semibold block mb-1">
                    Attach Relevant Task (Optional):
                  </label>
                  <select
                    value={attachedTaskId}
                    onChange={(e) => setAttachedTaskId(e.target.value)}
                    className="form-select w-full text-xs"
                  >
                    <option value="">-- No specific task attached --</option>
                    {tasks.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.title} ({t.status || 'In Progress'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRequestModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingRequest}
                >
                  {isSubmittingRequest ? 'Sending Request...' : 'Send Connection Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Summary Modal */}
      {viewSummarySession && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Assistance Summary</h3>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setViewSummarySession(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div className="text-xs text-muted">
                Session: <span className="font-mono">{viewSummarySession.sessionId}</span>
              </div>
              <div className="p-3 bg-card-subtle rounded-lg text-xs leading-relaxed">
                {viewSummarySession.assistanceSummary}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewSummarySession(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkConnectView;
