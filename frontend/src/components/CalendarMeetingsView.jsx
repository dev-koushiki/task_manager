import { useState, useEffect, useMemo } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  VideoIcon,
  MapPinIcon,
  UserIcon,
  UsersIcon,
  CheckIcon,
  BriefcaseIcon,
  EditIcon,
  TrashIcon,
} from './Icons';
import { api } from '../services/api';
import { emailService } from '../services/emailService';

export const CalendarMeetingsView = ({
  user,
  tasks = [],
  projects = [],
  employees = [],
  onTasksUpdated,
}) => {
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState('all'); // 'all' | 'meetings' | 'tasks'
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('details'); // 'details' | 'minutes'

  // Schedule / Edit Form
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    agenda: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    location: '',
    meetingLink: '',
    projectId: '',
    participants: [],
  });

  // Conflict warning state
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // Minutes Form State
  const [minutesForm, setMinutesForm] = useState({
    notes: '',
    decisions: [],
    actionItems: [],
  });
  const [newDecision, setNewDecision] = useState('');
  const [newActionItem, setNewActionItem] = useState({
    description: '',
    assigneeId: '',
    dueDate: '',
  });

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const data = await api.getMeetings();
      setMeetings(data || []);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  // Format Helper
  const formatDateKey = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check conflicts in real-time when schedule form changes
  useEffect(() => {
    if (!isScheduleModalOpen) return;
    if (!meetingForm.date || !meetingForm.startTime || !meetingForm.endTime) return;

    let active = true;
    const participantIds = meetingForm.participants.map((p) => p.userId || p.id).filter(Boolean);
    if (user?._id) participantIds.push(user._id);

    api
      .checkMeetingConflicts({
        date: meetingForm.date,
        startTime: meetingForm.startTime,
        endTime: meetingForm.endTime,
        participantIds,
        excludeMeetingId: editingMeeting ? (editingMeeting._id || editingMeeting.id) : null,
      })
      .then((res) => {
        if (active) {
          setConflictWarnings(res.conflicts || []);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [
    isScheduleModalOpen,
    meetingForm.date,
    meetingForm.startTime,
    meetingForm.endTime,
    meetingForm.participants,
    editingMeeting,
    user?._id,
  ]);

  // Calendar Navigation
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open Schedule Modal
  const handleOpenSchedule = (dateStr = null) => {
    setEditingMeeting(null);
    setMeetingForm({
      title: '',
      agenda: '',
      date: dateStr || formatDateKey(currentDate),
      startTime: '10:00',
      endTime: '11:00',
      location: '',
      meetingLink: '',
      projectId: projects.length > 0 ? (projects[0]._id || projects[0].id) : '',
      participants: [],
    });
    setConflictWarnings([]);
    setIsScheduleModalOpen(true);
  };

  // Open Edit Meeting Modal
  const handleOpenEditMeeting = (m) => {
    setEditingMeeting(m);
    setMeetingForm({
      title: m.title || '',
      agenda: m.agenda || '',
      date: m.date || formatDateKey(new Date()),
      startTime: m.startTime || '10:00',
      endTime: m.endTime || '11:00',
      location: m.location || '',
      meetingLink: m.meetingLink || '',
      projectId: m.projectId || '',
      participants: (m.participants || []).map((p) => ({
        userId: p.userId || p.id,
        name: p.name,
        email: p.email,
        status: p.status,
      })),
    });
    setIsDetailModalOpen(false);
    setIsScheduleModalOpen(true);
  };

  // Toggle Participant in Meeting Form
  const handleToggleParticipant = (emp) => {
    const empId = emp._id || emp.id;
    const exists = meetingForm.participants.some((p) => (p.userId || p.id) === empId);

    if (exists) {
      setMeetingForm((prev) => ({
        ...prev,
        participants: prev.participants.filter((p) => (p.userId || p.id) !== empId),
      }));
    } else {
      setMeetingForm((prev) => ({
        ...prev,
        participants: [
          ...prev.participants,
          {
            userId: empId,
            name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name,
            email: emp.email,
            status: 'pending',
          },
        ],
      }));
    }
  };

  // Submit Schedule / Edit Form
  const handleSubmitMeeting = async (e) => {
    e.preventDefault();
    if (!meetingForm.title.trim() || !meetingForm.date || !meetingForm.startTime || !meetingForm.endTime) {
      alert('Please fill in title, date, start time, and end time.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedProj = projects.find((p) => (p._id || p.id) === meetingForm.projectId);
      const payload = {
        ...meetingForm,
        projectName: selectedProj ? (selectedProj.title || selectedProj.name) : '',
      };

      if (editingMeeting) {
        await api.updateMeeting(editingMeeting._id || editingMeeting.id, payload);
      } else {
        await api.createMeeting(payload);
      }

      setIsScheduleModalOpen(false);
      loadMeetings();
    } catch (err) {
      alert(err.message || 'Failed to save meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Meeting Details
  const handleOpenMeetingDetail = (m) => {
    setSelectedMeeting(m);
    setActiveModalTab('details');
    setActionNotice('');
    setMinutesForm({
      notes: m.minutes?.notes || '',
      decisions: m.minutes?.decisions || [],
      actionItems: m.minutes?.actionItems || [],
    });
    setIsDetailModalOpen(true);
  };

  // RSVP response
  const handleRSVP = async (meetingId, status) => {
    try {
      await api.respondMeeting(meetingId, status);
      setActionNotice(`You have marked "${status}" for this meeting.`);
      loadMeetings();
      // Update selected meeting in place
      if (selectedMeeting && (selectedMeeting._id || selectedMeeting.id) === meetingId) {
        const updated = await api.getMeetingById(meetingId);
        setSelectedMeeting(updated);
      }
    } catch (err) {
      alert(err.message || 'Failed to record RSVP');
    }
  };

  // Cancel Meeting
  const handleCancelMeeting = async (meetingId) => {
    const reason = window.prompt('Enter reason for cancelling this meeting (optional):', '');
    if (reason === null) return; // user cancelled prompt

    try {
      await api.cancelMeeting(meetingId, reason);
      loadMeetings();
      setIsDetailModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to cancel meeting.');
    }
  };

  // Add Decision to minutes
  const handleAddDecision = () => {
    if (!newDecision.trim()) return;
    setMinutesForm((prev) => ({
      ...prev,
      decisions: [...prev.decisions, newDecision.trim()],
    }));
    setNewDecision('');
  };

  const handleRemoveDecision = (idx) => {
    setMinutesForm((prev) => ({
      ...prev,
      decisions: prev.decisions.filter((_, i) => i !== idx),
    }));
  };

  // Add Action Item to minutes
  const handleAddActionItem = () => {
    if (!newActionItem.description.trim()) {
      alert('Please enter action item description.');
      return;
    }
    const emp = employees.find((e) => (e._id || e.id) === newActionItem.assigneeId);
    setMinutesForm((prev) => ({
      ...prev,
      actionItems: [
        ...prev.actionItems,
        {
          description: newActionItem.description.trim(),
          assigneeId: newActionItem.assigneeId || null,
          assigneeName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Unassigned',
          dueDate: newActionItem.dueDate || selectedMeeting.date,
          status: 'pending',
        },
      ],
    }));
    setNewActionItem({ description: '', assigneeId: '', dueDate: '' });
  };

  const handleRemoveActionItem = (idx) => {
    setMinutesForm((prev) => ({
      ...prev,
      actionItems: prev.actionItems.filter((_, i) => i !== idx),
    }));
  };

  // Save Minutes
  const handleSaveMinutes = async () => {
    if (!selectedMeeting) return;
    try {
      const updated = await api.saveMeetingMinutes(selectedMeeting._id || selectedMeeting.id, minutesForm);
      setActionNotice('Meeting minutes and action items saved successfully!');
      setSelectedMeeting(updated.meeting);
      loadMeetings();
    } catch (err) {
      alert(err.message || 'Failed to save meeting minutes.');
    }
  };

  // Convert Action Item to Task
  const handleConvertActionItem = async (actionItemId) => {
    if (!selectedMeeting) return;
    try {
      const res = await api.convertMeetingActionItem(
        selectedMeeting._id || selectedMeeting.id,
        actionItemId
      );
      setActionNotice('Action item converted into a Task successfully!');
      setSelectedMeeting(res.meeting);
      loadMeetings();
      if (onTasksUpdated) onTasksUpdated();
    } catch (err) {
      alert(err.message || 'Failed to convert action item to task.');
    }
  };

  // Filter items (meetings and tasks) by date
  const eventsByDate = useMemo(() => {
    const map = new Map();

    const addEvent = (dateStr, event) => {
      if (!dateStr) return;
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr).push(event);
    };

    if (filterType === 'all' || filterType === 'meetings') {
      meetings.forEach((m) => {
        if (m.date) {
          addEvent(m.date, { type: 'meeting', data: m });
        }
      });
    }

    if (filterType === 'all' || filterType === 'tasks') {
      tasks.forEach((t) => {
        const taskDate = t.deadline || t.dueDate;
        if (taskDate) {
          addEvent(taskDate, { type: 'task', data: t });
        }
      });
    }

    return map;
  }, [meetings, tasks, filterType]);

  // Calendar Grid Computations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Month days
  const monthGridDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false, dateKey: formatDateKey(d) });
    }

    // Current month days
    for (let i = 1; i <= lastDay; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, dateKey: formatDateKey(d) });
    }

    // Next month padding to fill 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, dateKey: formatDateKey(d) });
    }

    return days;
  }, [year, month]);

  // Week days
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek); // start on Sunday

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, dateKey: formatDateKey(d) });
    }
    return days;
  }, [currentDate]);

  const todayKey = formatDateKey(new Date());

  // Check if current user is participant or organizer of a meeting
  const getUserRSVPStatus = (m) => {
    if (!m) return null;
    const currentUserId = (user?._id || user?.id || '').toString();
    if (m.organizer?.toString() === currentUserId) return 'organizer';
    const p = (m.participants || []).find((part) => (part.userId || part.id || '').toString() === currentUserId);
    return p ? p.status : null;
  };

  return (
    <div className="calendar-meetings-container animate-fade-in">
      {/* Top Controls Bar */}
      <div className="calendar-top-bar">
        <div className="cal-header-left">
          <div className="cal-nav-buttons">
            <button type="button" className="btn btn-secondary btn-sm cal-nav-btn" onClick={handlePrev} title="Previous">
              <ChevronLeftIcon size={16} />
            </button>
            <button type="button" className="btn btn-secondary btn-sm cal-today-btn" onClick={handleToday}>
              Today
            </button>
            <button type="button" className="btn btn-secondary btn-sm cal-nav-btn" onClick={handleNext} title="Next">
              <ChevronRightIcon size={16} />
            </button>
          </div>

          <h2 className="cal-current-label">
            {viewMode === 'month' && monthName}
            {viewMode === 'week' && `Week of ${weekDays[0].date.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${weekDays[6].date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {viewMode === 'day' && currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
        </div>

        <div className="cal-header-right">
          {/* Filter Pills */}
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Items
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === 'meetings' ? 'active' : ''}`}
              onClick={() => setFilterType('meetings')}
            >
              Meetings
            </button>
            <button
              type="button"
              className={`filter-pill ${filterType === 'tasks' ? 'active' : ''}`}
              onClick={() => setFilterType('tasks')}
            >
              Tasks & Deadlines
            </button>
          </div>

          {/* View Mode Buttons */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => setViewMode('day')}
            >
              Day
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary schedule-meeting-btn"
            onClick={() => handleOpenSchedule()}
          >
            <PlusIcon size={16} />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading workspace calendar...</p>
        </div>
      ) : (
        <>
          {/* ===================== MONTH VIEW ===================== */}
          {viewMode === 'month' && (
            <div className="calendar-month-grid-wrapper">
              <div className="calendar-weekdays-header">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="weekday-col-header">
                    {d}
                  </div>
                ))}
              </div>

              <div className="calendar-month-cells">
                {monthGridDays.map((cell, idx) => {
                  const dayEvents = eventsByDate.get(cell.dateKey) || [];
                  const isToday = cell.dateKey === todayKey;

                  return (
                    <div
                      key={idx}
                      className={`month-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}`}
                      onClick={() => {
                        setCurrentDate(cell.date);
                        setViewMode('day');
                      }}
                    >
                      <div className="cell-top-bar">
                        <span className={`cell-day-num ${isToday ? 'today-badge' : ''}`}>
                          {cell.date.getDate()}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="cell-event-count">{dayEvents.length}</span>
                        )}
                      </div>

                      <div className="cell-events-list">
                        {dayEvents.slice(0, 3).map((item, eIdx) => {
                          if (item.type === 'meeting') {
                            const isCancelled = item.data.status === 'cancelled';
                            return (
                              <div
                                key={`m_${eIdx}`}
                                className={`cal-event-pill meeting-pill ${isCancelled ? 'cancelled-pill' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenMeetingDetail(item.data);
                                }}
                                title={`${item.data.startTime} - ${item.data.title}`}
                              >
                                <ClockIcon size={10} className="pill-icon" />
                                <span className="pill-time">{item.data.startTime}</span>
                                <span className="pill-title">{item.data.title}</span>
                              </div>
                            );
                          } else {
                            return (
                              <div
                                key={`t_${eIdx}`}
                                className={`cal-event-pill task-pill priority-${item.data.priority || 'medium'}`}
                                onClick={(e) => e.stopPropagation()}
                                title={`Task Deadline: ${item.data.title}`}
                              >
                                <CheckCircleIcon size={10} className="pill-icon" />
                                <span className="pill-title">{item.data.title}</span>
                              </div>
                            );
                          }
                        })}
                        {dayEvents.length > 3 && (
                          <div className="more-events-indicator">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================== WEEK VIEW ===================== */}
          {viewMode === 'week' && (
            <div className="calendar-week-grid-wrapper">
              <div className="week-grid-header">
                {weekDays.map((col, idx) => {
                  const isToday = col.dateKey === todayKey;
                  return (
                    <div key={idx} className={`week-header-col ${isToday ? 'today-col' : ''}`}>
                      <span className="col-day-name">{col.date.toLocaleDateString([], { weekday: 'short' })}</span>
                      <span className={`col-day-num ${isToday ? 'today-num-badge' : ''}`}>{col.date.getDate()}</span>
                    </div>
                  );
                })}
              </div>

              <div className="week-columns-body">
                {weekDays.map((col, idx) => {
                  const dayEvents = eventsByDate.get(col.dateKey) || [];
                  const isToday = col.dateKey === todayKey;

                  return (
                    <div key={idx} className={`week-day-col ${isToday ? 'today-body-col' : ''}`}>
                      <div className="week-events-container">
                        {dayEvents.length === 0 ? (
                          <div className="no-events-day">No items</div>
                        ) : (
                          dayEvents.map((item, eIdx) => {
                            if (item.type === 'meeting') {
                              return (
                                <div
                                  key={`wm_${eIdx}`}
                                  className={`week-meeting-card ${item.data.status === 'cancelled' ? 'cancelled' : ''}`}
                                  onClick={() => handleOpenMeetingDetail(item.data)}
                                >
                                  <div className="card-time-slot">
                                    <ClockIcon size={12} />
                                    <span>{item.data.startTime} - {item.data.endTime}</span>
                                  </div>
                                  <strong className="card-title">{item.data.title}</strong>
                                  {item.data.location && (
                                    <span className="card-meta"><MapPinIcon size={11} /> {item.data.location}</span>
                                  )}
                                  {item.data.meetingLink && (
                                    <span className="card-meta link-meta"><VideoIcon size={11} /> Link Attached</span>
                                  )}
                                  <div className="card-participants-row">
                                    <UsersIcon size={11} /> {item.data.participants?.length || 0} participants
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div key={`wt_${eIdx}`} className="week-task-card">
                                  <div className="task-deadline-header">
                                    <CheckCircleIcon size={12} /> Deadline
                                  </div>
                                  <strong className="card-title">{item.data.title}</strong>
                                  <div className="task-assignee">
                                    <UserIcon size={11} /> {item.data.assignedToName || 'Unassigned'}
                                  </div>
                                  <span className={`priority-tag-sm priority-${item.data.priority || 'medium'}`}>
                                    {item.data.priority || 'medium'}
                                  </span>
                                </div>
                              );
                            }
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================== DAY VIEW ===================== */}
          {viewMode === 'day' && (
            <div className="calendar-day-view-wrapper">
              <div className="day-view-card">
                <div className="day-header-banner">
                  <div className="day-banner-left">
                    <h3>
                      {currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <p className="day-subtitle">
                      {eventsByDate.get(formatDateKey(currentDate))?.length || 0} scheduled tasks & meetings for today
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenSchedule(formatDateKey(currentDate))}
                  >
                    <PlusIcon size={14} /> Schedule for this day
                  </button>
                </div>

                <div className="day-timeline-list">
                  {(eventsByDate.get(formatDateKey(currentDate)) || []).length === 0 ? (
                    <div className="day-empty-state">
                      <CalendarIcon size={40} className="empty-icon text-accent" />
                      <h4>No scheduled items for this date</h4>
                      <p>Use the buttons above to schedule a team meeting or assign tasks.</p>
                    </div>
                  ) : (
                    (eventsByDate.get(formatDateKey(currentDate)) || []).map((item, idx) => {
                      if (item.type === 'meeting') {
                        const m = item.data;
                        const userRSVP = getUserRSVPStatus(m);
                        const isOrganizer = userRSVP === 'organizer';

                        return (
                          <div key={idx} className={`day-timeline-item meeting-item ${m.status === 'cancelled' ? 'cancelled-item' : ''}`}>
                            <div className="timeline-time-box">
                              <span className="time-start">{m.startTime}</span>
                              <span className="time-end">{m.endTime}</span>
                            </div>

                            <div className="timeline-content-card">
                              <div className="card-top-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <h4 className="item-title" onClick={() => handleOpenMeetingDetail(m)} style={{ cursor: 'pointer' }}>
                                    {m.title}
                                  </h4>
                                  <span className={`status-pill status-${m.status}`}>{m.status}</span>
                                  {m.projectName && <span className="project-tag-pill">{m.projectName}</span>}
                                </div>

                                <div className="card-actions">
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => handleOpenMeetingDetail(m)}
                                  >
                                    View Details & Minutes
                                  </button>
                                </div>
                              </div>

                              {m.agenda && <p className="item-agenda">{m.agenda}</p>}

                              <div className="item-metadata-row">
                                <span className="meta-point">
                                  <UserIcon size={13} /> Organizer: <strong>{m.organizerName}</strong>
                                </span>
                                {m.location && (
                                  <span className="meta-point">
                                    <MapPinIcon size={13} /> {m.location}
                                  </span>
                                )}
                                {m.meetingLink && (
                                  <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="meta-point link-btn">
                                    <VideoIcon size={13} /> Join Online Meeting
                                  </a>
                                )}
                                <span className="meta-point">
                                  <UsersIcon size={13} /> {m.participants?.length || 0} invited
                                </span>
                              </div>

                              {/* Quick RSVP row if invitee */}
                              {!isOrganizer && m.status === 'scheduled' && (
                                <div className="rsvp-action-strip">
                                  <span>Your RSVP: <strong>{userRSVP || 'pending'}</strong></span>
                                  <div className="rsvp-buttons">
                                    <button
                                      type="button"
                                      className={`btn btn-xs ${userRSVP === 'accepted' ? 'btn-success' : 'btn-secondary'}`}
                                      onClick={() => handleRSVP(m._id || m.id, 'accepted')}
                                    >
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn-xs ${userRSVP === 'tentative' ? 'btn-warning' : 'btn-secondary'}`}
                                      onClick={() => handleRSVP(m._id || m.id, 'tentative')}
                                    >
                                      Tentative
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn-xs ${userRSVP === 'declined' ? 'btn-danger' : 'btn-secondary'}`}
                                      onClick={() => handleRSVP(m._id || m.id, 'declined')}
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        const t = item.data;
                        return (
                          <div key={idx} className="day-timeline-item task-item">
                            <div className="timeline-time-box">
                              <span className="time-start">Task</span>
                              <span className="time-end">Due</span>
                            </div>

                            <div className="timeline-content-card task-content-card">
                              <div className="card-top-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <h4 className="item-title">{t.title}</h4>
                                  <span className={`priority-tag priority-${t.priority || 'medium'}`}>{t.priority}</span>
                                  <span className={`status-pill status-${t.status || 'not-started'}`}>{t.status || 'not-started'}</span>
                                </div>
                              </div>
                              {t.description && <p className="item-agenda">{t.description}</p>}
                              <div className="item-metadata-row">
                                <span className="meta-point">
                                  <UserIcon size={13} /> Assigned to: <strong>{t.assignedToName || 'Unassigned'}</strong>
                                </span>
                                <span className="meta-point">
                                  Progress: <strong>{t.progress || 0}%</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================== SCHEDULE / EDIT MODAL ===================== */}
      {isScheduleModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsScheduleModalOpen(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingMeeting ? 'Edit Meeting' : 'Schedule New Meeting'}</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitMeeting} className="modal-form">
              {conflictWarnings.length > 0 && (
                <div className="alert-box alert-warning animate-fade-in" style={{ marginBottom: '14px' }}>
                  <AlertTriangleIcon size={18} />
                  <div>
                    <strong>Availability Conflict Warning:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {conflictWarnings.map((c, i) => (
                        <li key={i}>
                          <strong>{c.name}</strong> already has &quot;{c.meetingTitle}&quot; scheduled ({c.startTime} - {c.endTime}).
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Meeting Title *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Q4 Sprint Planning & Architecture Review"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className="input-field"
                    value={meetingForm.startTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input
                    type="time"
                    className="input-field"
                    value={meetingForm.endTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Meeting Location</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Conference Room A, HQ Floor 3"
                    value={meetingForm.location}
                    onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Online Meeting Link (Google Meet / Zoom)</label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://meet.google.com/xyz-abcd-efg"
                    value={meetingForm.meetingLink}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meetingLink: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Associated Project</label>
                <select
                  className="input-field"
                  value={meetingForm.projectId}
                  onChange={(e) => setMeetingForm({ ...meetingForm, projectId: e.target.value })}
                >
                  <option value="">-- No specific project --</option>
                  {projects.map((p) => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.title || p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Meeting Agenda & Objectives</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Outline key discussion topics, goals, and prerequisites..."
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
                />
              </div>

              {/* Participants Selector */}
              <div className="form-group">
                <label className="form-label">
                  Invite Participants ({meetingForm.participants.length} selected)
                </label>
                <div className="participants-selector-grid">
                  {employees.map((emp) => {
                    const empId = emp._id || emp.id;
                    const isSelected = meetingForm.participants.some((p) => (p.userId || p.id) === empId);

                    return (
                      <div
                        key={empId}
                        className={`participant-pill-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleParticipant(emp)}
                      >
                        <div className="avatar-circle-xs">
                          {emp.firstName ? emp.firstName[0].toUpperCase() : 'U'}
                        </div>
                        <div className="participant-info-mini">
                          <span className="p-name">{emp.firstName} {emp.lastName}</span>
                          <span className="p-dept">{emp.department || emp.role}</span>
                        </div>
                        {isSelected && <CheckIcon size={14} className="text-primary" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions-right">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingMeeting ? 'Update Meeting' : 'Schedule Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MEETING DETAILS & MINUTES MODAL ===================== */}
      {isDetailModalOpen && selectedMeeting && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsDetailModalOpen(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>{selectedMeeting.title}</h3>
                <span className={`status-pill status-${selectedMeeting.status}`}>{selectedMeeting.status}</span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs: Overview vs Minutes */}
            <div className="meeting-modal-tabs">
              <button
                type="button"
                className={`tab-btn ${activeModalTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('details')}
              >
                Meeting Overview & RSVP
              </button>
              <button
                type="button"
                className={`tab-btn ${activeModalTab === 'minutes' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('minutes')}
              >
                Meeting Minutes & Follow-up Tasks ({selectedMeeting.minutes?.actionItems?.length || 0})
              </button>
            </div>

            {actionNotice && (
              <div className="alert-box alert-success animate-fade-in" style={{ margin: '10px 20px 0' }}>
                <CheckCircleIcon size={16} />
                <span>{actionNotice}</span>
              </div>
            )}

            <div className="modal-body-content">
              {/* TAB 1: DETAILS & RSVP */}
              {activeModalTab === 'details' && (
                <div className="meeting-details-pane">
                  <div className="details-grid-2">
                    <div className="detail-field">
                      <span className="field-lbl">Date & Time</span>
                      <span className="field-val">
                        <ClockIcon size={14} className="text-accent" />
                        {selectedMeeting.date} • {selectedMeeting.startTime} - {selectedMeeting.endTime}
                      </span>
                    </div>

                    <div className="detail-field">
                      <span className="field-lbl">Organizer</span>
                      <span className="field-val">
                        <UserIcon size={14} className="text-accent" />
                        {selectedMeeting.organizerName}
                      </span>
                    </div>

                    {selectedMeeting.location && (
                      <div className="detail-field">
                        <span className="field-lbl">Location</span>
                        <span className="field-val">
                          <MapPinIcon size={14} className="text-accent" />
                          {selectedMeeting.location}
                        </span>
                      </div>
                    )}

                    {selectedMeeting.meetingLink && (
                      <div className="detail-field">
                        <span className="field-lbl">Meeting Link</span>
                        <a
                          href={selectedMeeting.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="field-val link"
                        >
                          <VideoIcon size={14} /> Open Meeting URL
                        </a>
                      </div>
                    )}

                    {selectedMeeting.projectName && (
                      <div className="detail-field">
                        <span className="field-lbl">Project</span>
                        <span className="field-val">
                          <BriefcaseIcon size={14} className="text-accent" />
                          {selectedMeeting.projectName}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedMeeting.agenda && (
                    <div className="detail-agenda-box">
                      <span className="field-lbl">Agenda & Key Topics</span>
                      <p>{selectedMeeting.agenda}</p>
                    </div>
                  )}

                  {/* Participants & RSVP Table */}
                  <div className="participants-status-section">
                    <h4>
                      Participants & RSVPs <span className="count-badge">{selectedMeeting.participants?.length || 0}</span>
                    </h4>

                    <div className="participants-status-list">
                      {(selectedMeeting.participants || []).map((p, idx) => {
                        const statusColor =
                          p.status === 'accepted'
                            ? 'success'
                            : p.status === 'declined'
                            ? 'danger'
                            : p.status === 'tentative'
                            ? 'warning'
                            : 'secondary';

                        return (
                          <div key={idx} className="participant-rsvp-row">
                            <div className="p-user">
                              <div className="avatar-circle-xs">
                                {p.name ? p.name[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <strong>{p.name}</strong>
                                <span className="p-email">{p.email}</span>
                              </div>
                            </div>

                            <div className="p-status">
                              <span className={`badge badge-${statusColor}`}>
                                {p.status || 'pending'}
                              </span>
                              {p.respondedAt && (
                                <small className="responded-time">
                                  {new Date(p.respondedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </small>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* My RSVP Buttons */}
                  {selectedMeeting.status === 'scheduled' && (
                    <div className="my-rsvp-control-panel">
                      <span>Change Your RSVP:</span>
                      <div className="rsvp-btn-group">
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={() => handleRSVP(selectedMeeting._id || selectedMeeting.id, 'accepted')}
                        >
                          <CheckCircleIcon size={14} /> Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-warning btn-sm"
                          onClick={() => handleRSVP(selectedMeeting._id || selectedMeeting.id, 'tentative')}
                        >
                          <AlertTriangleIcon size={14} /> Tentative
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleRSVP(selectedMeeting._id || selectedMeeting.id, 'declined')}
                        >
                          <XCircleIcon size={14} /> Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Organizer Controls */}
                  <div className="modal-bottom-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEditMeeting(selectedMeeting)}
                    >
                      <EditIcon size={14} /> Edit Meeting
                    </button>

                    {selectedMeeting.status === 'scheduled' && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleCancelMeeting(selectedMeeting._id || selectedMeeting.id)}
                      >
                        <TrashIcon size={14} /> Cancel Meeting
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: MINUTES & ACTION ITEMS */}
              {activeModalTab === 'minutes' && (
                <div className="meeting-minutes-pane">
                  <div className="form-group">
                    <label className="form-label">Meeting Notes & Summary</label>
                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder="Record discussion summary, key highlights, and meeting outcomes..."
                      value={minutesForm.notes}
                      onChange={(e) => setMinutesForm({ ...minutesForm, notes: e.target.value })}
                    />
                  </div>

                  {/* Decisions Section */}
                  <div className="minutes-section">
                    <h4>Agreed Decisions</h4>
                    <div className="input-with-button">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Approved mobile redesign timeline for sprint 4"
                        value={newDecision}
                        onChange={(e) => setNewDecision(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDecision();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddDecision}
                      >
                        Add Decision
                      </button>
                    </div>

                    <div className="decisions-list">
                      {minutesForm.decisions.length === 0 ? (
                        <p className="empty-hint">No decisions recorded yet.</p>
                      ) : (
                        minutesForm.decisions.map((dec, i) => (
                          <div key={i} className="decision-item">
                            <CheckIcon size={14} className="text-success" />
                            <span>{dec}</span>
                            <button
                              type="button"
                              className="remove-btn"
                              onClick={() => handleRemoveDecision(i)}
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Action Items Section */}
                  <div className="minutes-section">
                    <h4>Action Items & Follow-up Tasks</h4>
                    <div className="action-item-creator-card">
                      <div className="form-row-3">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Action item description (e.g. Update Figma mockups with feedback)"
                            value={newActionItem.description}
                            onChange={(e) =>
                              setNewActionItem({ ...newActionItem, description: e.target.value })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <input
                            type="date"
                            className="input-field"
                            value={newActionItem.dueDate}
                            onChange={(e) =>
                              setNewActionItem({ ...newActionItem, dueDate: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="action-creator-bottom">
                        <select
                          className="input-field"
                          value={newActionItem.assigneeId}
                          onChange={(e) =>
                            setNewActionItem({ ...newActionItem, assigneeId: e.target.value })
                          }
                        >
                          <option value="">-- Assign To (Employee) --</option>
                          {employees.map((emp) => (
                            <option key={emp._id || emp.id} value={emp._id || emp.id}>
                              {emp.firstName} {emp.lastName} ({emp.department})
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleAddActionItem}
                        >
                          + Add Action Item
                        </button>
                      </div>
                    </div>

                    {/* Action Items List with "Convert to Task" button */}
                    <div className="action-items-list">
                      {minutesForm.actionItems.length === 0 ? (
                        <p className="empty-hint">No action items created yet.</p>
                      ) : (
                        minutesForm.actionItems.map((ai, i) => {
                          const isConverted = ai.status === 'converted' || Boolean(ai.convertedToTaskId);
                          return (
                            <div key={i} className="action-item-card">
                              <div className="ai-content">
                                <strong>{ai.description}</strong>
                                <div className="ai-meta">
                                  <span><UserIcon size={12} /> {ai.assigneeName || 'Unassigned'}</span>
                                  <span><ClockIcon size={12} /> Due: {ai.dueDate || 'Flexible'}</span>
                                  {isConverted && (
                                    <span className="badge badge-success">
                                      <CheckCircleIcon size={11} /> Converted to Task
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="ai-actions">
                                {!isConverted ? (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-xs convert-task-btn"
                                    onClick={() => handleConvertActionItem(ai._id || ai.id)}
                                    title="Generate task in task manager"
                                  >
                                    Convert to Task →
                                  </button>
                                ) : (
                                  <span className="converted-check-text">✓ Active Task</span>
                                )}

                                {!isConverted && (
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-xs"
                                    onClick={() => handleRemoveActionItem(i)}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="modal-actions-right" style={{ marginTop: '20px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsDetailModalOpen(false)}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveMinutes}
                    >
                      Save Minutes & Complete Meeting
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
