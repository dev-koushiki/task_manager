import { useState, useMemo, useEffect } from 'react';
import {
  SparklesIcon,
  PlusIcon,
  SearchIcon,
  CalendarIcon,
  CheckIcon,
  UsersIcon,
  UserIcon,
  MicIcon,
  MoreVerticalIcon,
  ClockIcon,
  CheckCircleIcon,
  TrashIcon,
  EditIcon,
  PlayIcon,
  PauseIcon,
} from './Icons';
import { SearchableEmployeeAssignModal } from './SearchableEmployeeAssignModal';
import { ConceptNoteModal } from './ConceptNoteModal';
import { VoiceRecordingModal } from './VoiceRecordingModal';
import { api } from '../services/api';

export const ProjectSectionView = ({
  user,
  projects = [],
  onOpenNewProject,
  onEditProject,
  onDeleteProject,
  onProjectsUpdated,
  initialProjectId = null,
  initialMilestoneId = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedProjects, setExpandedProjects] = useState(() => {
    const map = {};
    if (initialProjectId) {
      map[initialProjectId] = true;
    }
    return map;
  });

  const toggleProjectExpand = (pId) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [pId]: prev[pId] !== undefined ? !prev[pId] : false,
    }));
  };

  // Modals state
  const [isConceptModalOpen, setIsConceptModalOpen] = useState(false);
  const [assignModalTarget, setAssignModalTarget] = useState(null); // { type: 'project' | 'milestone', project, milestone }
  const [voiceModalTarget, setVoiceModalTarget] = useState(null); // { project, milestone }

  // Auto-scroll and highlight target project from notification link
  useEffect(() => {
    if (initialProjectId) {
      setTimeout(() => {
        const el = document.getElementById(`project-${initialProjectId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.outline = '2px solid var(--primary-color)';
          el.style.boxShadow = '0 0 16px rgba(99, 102, 241, 0.4)';
          setTimeout(() => {
            el.style.outline = '';
            el.style.boxShadow = '';
          }, 3500);
        }
      }, 300);
    }
  }, [initialProjectId]);

  // Auto-scroll and highlight target milestone from notification link
  useEffect(() => {
    if (initialMilestoneId) {
      setTimeout(() => {
        const el = document.getElementById(`milestone-${initialMilestoneId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.outline = '2px solid #10b981';
          el.style.background = 'rgba(16, 185, 129, 0.12)';
          setTimeout(() => {
            el.style.outline = '';
            el.style.background = '';
          }, 3500);
        }
      }, 400);
    }
  }, [initialMilestoneId]);

  // Quick milestone creation / editing state
  const [milestoneModalTarget, setMilestoneModalTarget] = useState(null); // { project, milestoneToEdit }
  const [milestoneFormData, setMilestoneFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    phase: '',
    status: 'not-started',
  });
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [activeAudioPlayingId, setActiveAudioPlayingId] = useState(null);

  const departments = [
    'All',
    'General',
    'Engineering',
    'Product',
    'Design',
    'Marketing',
    'Sales',
    'Operations',
    'Finance',
    'Human Resources',
  ];

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const dept = (p.department || 'General').toLowerCase();

      const matchesSearch = !q || name.includes(q) || desc.includes(q) || dept.includes(q);
      if (!matchesSearch) return false;

      if (selectedDept !== 'All' && (p.department || 'General').toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }

      const pStatus = p.status || p.metrics?.calculatedStatus || 'not-started';
      if (statusFilter === 'all') return true;
      if (statusFilter === 'completed') return pStatus === 'completed';
      if (statusFilter === 'in-progress') return pStatus === 'in-progress' || pStatus === 'on-track';
      if (statusFilter === 'delayed') return pStatus === 'delayed';
      if (statusFilter === 'not-started') return pStatus === 'not-started';
      return true;
    });
  }, [projects, searchTerm, selectedDept, statusFilter]);

  // Handle milestone add or update
  const handleOpenMilestoneModal = (project, milestone = null) => {
    setMilestoneModalTarget({ project, milestoneToEdit: milestone });
    if (milestone) {
      setMilestoneFormData({
        title: milestone.title || '',
        description: milestone.description || '',
        deadline: milestone.deadline || milestone.dueDate || '',
        phase: milestone.phase || '',
        status: milestone.status || 'not-started',
      });
    } else {
      setMilestoneFormData({
        title: '',
        description: '',
        deadline: project.targetCompletionDate || project.deadline || '',
        phase: '',
        status: 'not-started',
      });
    }
  };

  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneModalTarget || !milestoneFormData.title.trim()) return;

    try {
      setMilestoneSaving(true);
      const { project, milestoneToEdit } = milestoneModalTarget;

      if (milestoneToEdit) {
        await api.updateProjectMilestone(project._id || project.id, milestoneToEdit._id || milestoneToEdit.id, milestoneFormData);
      } else {
        await api.addProjectMilestone(project._id || project.id, milestoneFormData);
      }

      setMilestoneModalTarget(null);
      if (onProjectsUpdated) onProjectsUpdated();
    } catch (err) {
      console.error('Milestone save error:', err);
      alert(err.message || 'Failed to save milestone.');
    } finally {
      setMilestoneSaving(false);
    }
  };

  const handleDeleteMilestone = async (projectId, milestoneId) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    try {
      await api.deleteProjectMilestone(projectId, milestoneId);
      if (onProjectsUpdated) onProjectsUpdated();
    } catch (err) {
      console.error('Delete milestone error:', err);
      alert(err.message || 'Failed to delete milestone.');
    }
  };

  const handleToggleMilestoneCompleted = async (project, milestone) => {
    try {
      const willComplete = !milestone.completed;
      await api.updateProjectMilestone(project._id || project.id, milestone._id || milestone.id, {
        completed: willComplete,
        status: willComplete ? 'completed' : 'in-progress',
      });
      if (onProjectsUpdated) onProjectsUpdated();
    } catch (err) {
      console.error('Toggle completion error:', err);
      alert(err.message || 'Failed to update milestone completion.');
    }
  };

  // Handle Employee Assignment modal submit
  const handleConfirmAssignment = async (employeeIds) => {
    if (!assignModalTarget) return;
    const { type, project, milestone } = assignModalTarget;

    if (type === 'project') {
      await api.assignProjectEmployees(project._id || project.id, employeeIds);
    } else if (type === 'milestone') {
      await api.assignMilestoneEmployees(project._id || project.id, milestone._id || milestone.id, employeeIds);
    }

    if (onProjectsUpdated) onProjectsUpdated();
  };

  // Handle Voice Recording save
  const handleSaveRecording = async (payload) => {
    if (!voiceModalTarget?.project) return;
    await api.uploadProjectRecording(voiceModalTarget.project._id || voiceModalTarget.project.id, payload);
    if (onProjectsUpdated) onProjectsUpdated();
  };

  // Handle audio play/pause for voice notes
  const toggleAudioNote = (audioId, audioUrl) => {
    const audioEl = document.getElementById(`audio-player-${audioId}`);
    if (!audioEl) return;

    if (activeAudioPlayingId === audioId) {
      audioEl.pause();
      setActiveAudioPlayingId(null);
    } else {
      if (activeAudioPlayingId) {
        const prev = document.getElementById(`audio-player-${activeAudioPlayingId}`);
        if (prev) prev.pause();
      }
      audioEl.play();
      setActiveAudioPlayingId(audioId);
    }
  };

  return (
    <div className="project-section-wrapper animate-fade-in">
      {/* Top Controls Bar */}
      <div className="project-top-toolbar">
        <div className="toolbar-left-group">
          {/* Search bar */}
          <div className="project-search-box">
            <SearchIcon size={16} className="text-muted" />
            <input
              type="text"
              placeholder="Search projects, scope, or domain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="project-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
              >
                &times;
              </button>
            )}
          </div>

          {/* Department Selection */}
          <div className="dept-select-wrap">
            <label>Domain:</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="dept-select"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Pills */}
          <div className="project-status-pills">
            <button
              type="button"
              className={`wa-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({projects.length})
            </button>
            <button
              type="button"
              className={`wa-filter-pill ${statusFilter === 'in-progress' ? 'active' : ''}`}
              onClick={() => setStatusFilter('in-progress')}
            >
              In Progress
            </button>
            <button
              type="button"
              className={`wa-filter-pill ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              Completed
            </button>
            <button
              type="button"
              className={`wa-filter-pill ${statusFilter === 'delayed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('delayed')}
            >
              Delayed
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="toolbar-actions-group">
          <button
            type="button"
            className="btn btn-secondary glow-effect"
            onClick={() => setIsConceptModalOpen(true)}
            title="Upload concept note PDF/DOCX and extract milestones with AI"
          >
            <SparklesIcon size={16} className="text-accent" />
            <span>Upload Concept Note (AI)</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenNewProject}
          >
            <PlusIcon size={16} />
            <span>Initialize Project</span>
          </button>
        </div>
      </div>

      {/* Projects List View */}
      {filteredProjects.length === 0 ? (
        <div className="projects-zero-state">
          <div className="zero-state-icon-wrap">
            <SparklesIcon size={44} className="text-primary" />
          </div>
          <h3>No Projects Found</h3>
          <p>
            {searchTerm || selectedDept !== 'All'
              ? 'No projects match your current filters. Try resetting search or domain.'
              : 'Organize your organization workflows by initializing a new Project or uploading a Concept Note with AI.'}
          </p>
          <div className="zero-state-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsConceptModalOpen(true)}
            >
              <SparklesIcon size={16} className="text-accent" /> Upload Concept Note
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenNewProject}
            >
              <PlusIcon size={16} /> Initialize Project
            </button>
          </div>
        </div>
      ) : (
        <div className="project-cards-container">
          {filteredProjects.map((proj) => {
            const pId = proj._id || proj.id;
            const milestones = Array.isArray(proj.milestones) ? proj.milestones : [];
            const completedCount = milestones.filter((m) => m.completed || m.status === 'completed').length;
            const progressPct =
              milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : proj.progress || 0;
            const assignedEmps = Array.isArray(proj.assignedEmployees) ? proj.assignedEmployees : [];
            const recordings = Array.isArray(proj.recordings) ? proj.recordings : [];
            const isExpanded = expandedProjects[pId] !== undefined ? expandedProjects[pId] : true;

            const pStatus = proj.status || proj.metrics?.calculatedStatus || 'not-started';
            const statusClass =
              pStatus === 'completed'
                ? 'status-badge-completed'
                : pStatus === 'delayed'
                ? 'status-badge-delayed'
                : pStatus === 'in-progress' || pStatus === 'on-track'
                ? 'status-badge-progress'
                : 'status-badge-neutral';

            return (
              <div key={pId} id={`project-${pId}`} className="project-structured-card animate-scale-up">
                {/* Project Header Row */}
                <div className="proj-header-row">
                  <div className="proj-header-left">
                    <div className="proj-tags-line">
                      <span className="wa-badge-dept">
                        {proj.department || 'General'}
                      </span>
                      <span className={`proj-status-badge ${statusClass}`}>
                        {pStatus.toUpperCase()}
                      </span>
                      <span className="proj-priority-badge">
                        {proj.priority?.toUpperCase() || 'MEDIUM'}
                      </span>
                    </div>
                    <h2 className="proj-title">{proj.name}</h2>
                    {proj.description && (
                      <p className="proj-description">{proj.description}</p>
                    )}
                  </div>

                  {/* Project Controls */}
                  <div className="proj-header-right">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs"
                      onClick={() => setVoiceModalTarget({ project: proj, milestone: null })}
                      title="Add voice note to project"
                    >
                      <MicIcon size={14} /> Voice Note
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs"
                      onClick={() => handleOpenMilestoneModal(proj)}
                      title="Add milestone underneath project"
                    >
                      <PlusIcon size={14} /> Add Milestone
                    </button>
                    <button
                      type="button"
                      className="btn-icon-action"
                      onClick={() => onEditProject(proj)}
                      title="Edit project details"
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-action text-danger"
                      onClick={() => onDeleteProject(pId)}
                      title="Delete project"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>

                {/* Project Metadata Details Grid */}
                <div className="proj-details-grid">
                  {/* Dates Box */}
                  <div className="proj-meta-card">
                    <span className="proj-meta-label">Project Dates</span>
                    <div className="proj-dates-values">
                      <div className="date-item">
                        <CalendarIcon size={14} className="text-muted" />
                        <span>Start: <strong>{proj.startDate || 'Immediate'}</strong></span>
                      </div>
                      <div className="date-item">
                        <ClockIcon size={14} className="text-primary" />
                        <span>Target: <strong>{proj.targetCompletionDate || proj.deadline || 'TBD'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Director / Supervisor */}
                  <div className="proj-meta-card">
                    <span className="proj-meta-label">Project Director</span>
                    <div className="proj-director-info">
                      <UserIcon size={16} className="text-accent" />
                      <strong>{proj.directorName || 'Administrator'}</strong>
                    </div>
                  </div>

                  {/* Assigned Employees */}
                  <div className="proj-meta-card" style={{ flex: 2 }}>
                    <div className="proj-assigned-header">
                      <span className="proj-meta-label">Assigned to Employee ({assignedEmps.length})</span>
                      <button
                        type="button"
                        className="btn-link-xs"
                        onClick={() =>
                          setAssignModalTarget({
                            type: 'project',
                            project: proj,
                            milestone: null,
                          })
                        }
                      >
                        + Assign to Employee
                      </button>
                    </div>

                    <div className="proj-assigned-chips-wrap">
                      {assignedEmps.length === 0 ? (
                        <span className="text-muted" style={{ fontSize: '12px' }}>
                          No employees assigned yet. Click Assign to Employee.
                        </span>
                      ) : (
                        assignedEmps.map((emp) => (
                          <div key={emp.userId || emp.email} className="proj-assignee-pill">
                            <span className="pill-avatar">
                              {emp.name?.[0]?.toUpperCase() || 'E'}
                            </span>
                            <span className="pill-name">{emp.name}</span>
                            {emp.designation && <span className="pill-role">({emp.designation})</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Overall Progress Bar */}
                <div className="proj-progress-section">
                  <div className="progress-info-row">
                    <span className="progress-label">Milestone Completion Tracking</span>
                    <span className="progress-pct-badge">{progressPct}% Complete ({completedCount} / {milestones.length} Milestones)</span>
                  </div>
                  <div className="progress-track-bg">
                    <div
                      className={`progress-fill-bar ${progressPct === 100 ? 'bar-green' : 'bar-primary'}`}
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>
                </div>

                {/* Audio Voice Notes List (if any attached to project) */}
                {recordings.length > 0 && (
                  <div className="proj-recordings-shelf">
                    <span className="recordings-shelf-title">
                      <MicIcon size={14} className="text-primary" /> Audio Instructions & Notes ({recordings.length}):
                    </span>
                    <div className="recordings-chips-grid">
                      {recordings.map((rec) => {
                        const recId = rec._id || rec.id;
                        const isThisPlaying = activeAudioPlayingId === recId;
                        return (
                          <div key={recId} className="recording-mini-player">
                            <button
                              type="button"
                              className="btn-play-mini"
                              onClick={() => toggleAudioNote(recId, rec.audioUrl)}
                            >
                              {isThisPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                            </button>
                            <div className="rec-text-wrap">
                              <strong>{rec.title || 'Voice Note'}</strong>
                              {rec.transcript && <p className="rec-snippet">&ldquo;{rec.transcript}&rdquo;</p>}
                            </div>
                            <audio
                              id={`audio-player-${recId}`}
                              src={rec.audioUrl}
                              onEnded={() => setActiveAudioPlayingId(null)}
                              style={{ display: 'none' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Milestones Breakdown Section Underneath the Project */}
                <div className="proj-milestones-underneath">
                  <div className="milestones-underneath-header">
                    <button
                      type="button"
                      className="btn-toggle-milestones"
                      onClick={() => toggleProjectExpand(pId)}
                      title={isExpanded ? 'Collapse milestones' : 'Expand milestones'}
                    >
                      <span className="toggle-milestone-chevron">{isExpanded ? '▼' : '▶'}</span>
                      <h4>
                        Project Milestones ({completedCount} / {milestones.length} Completed)
                      </h4>
                    </button>
                    <div className="milestone-header-actions">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-xs"
                        onClick={() => handleOpenMilestoneModal(proj)}
                      >
                        <PlusIcon size={13} /> Add Milestone
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <>
                      {milestones.length === 0 ? (
                        <div className="milestones-empty-box">
                          <p>No milestones created underneath this project yet.</p>
                          <button
                            type="button"
                            className="btn-link-sm"
                            onClick={() => handleOpenMilestoneModal(proj)}
                          >
                            + Create first milestone deliverable
                          </button>
                        </div>
                      ) : (
                        <div className="milestones-list-table">
                          {milestones.map((m, idx) => {
                            const mId = m._id || m.id;
                            const isDone = m.completed || m.status === 'completed';
                            const mAssignees = Array.isArray(m.assignedTo) ? m.assignedTo : [];

                            return (
                              <div
                                key={mId || idx}
                                id={mId ? `milestone-${mId}` : undefined}
                                className={`milestone-item-row ${isDone ? 'milestone-done' : ''}`}
                              >
                                {/* Checkbox for Completion Tracking */}
                                <button
                                  type="button"
                                  className={`milestone-check-btn ${isDone ? 'checked' : ''}`}
                                  onClick={() => handleToggleMilestoneCompleted(proj, m)}
                                  title={isDone ? 'Mark as incomplete' : 'Mark milestone completed'}
                                >
                                  {isDone ? <CheckIcon size={12} className="check-icon" /> : null}
                                </button>

                                {/* Milestone Content */}
                                <div className="milestone-content-block">
                                  <div className="milestone-title-line">
                                    <span className={`milestone-title ${isDone ? 'strikethrough' : ''}`}>
                                      {m.title}
                                    </span>
                                    {m.phase && <span className="milestone-phase-badge">{m.phase}</span>}
                                    <span
                                      className={`milestone-status-tag ${
                                        isDone
                                          ? 'tag-done'
                                          : m.status === 'in-progress'
                                          ? 'tag-progress'
                                          : 'tag-todo'
                                      }`}
                                    >
                                      {m.status?.toUpperCase() || 'NOT-STARTED'}
                                    </span>
                                  </div>

                                  {m.description && (
                                    <p className="milestone-desc-text">{m.description}</p>
                                  )}

                                  <div className="milestone-bottom-meta">
                                    <span className="milestone-deadline-pill">
                                      <CalendarIcon size={12} /> Deadline: <strong>{m.deadline || m.dueDate || 'No date'}</strong>
                                    </span>

                                    {isDone && m.completedAt && (
                                      <span className="milestone-completed-pill">
                                        <CheckCircleIcon size={12} className="text-success" /> Completed: {new Date(m.completedAt).toLocaleDateString()} by {m.completedByName || 'Assignee'}
                                      </span>
                                    )}

                                    {/* Assignee Pill & Assignment Action */}
                                    <div className="milestone-assignees-wrap">
                                      {mAssignees.length > 0 ? (
                                        mAssignees.map((emp) => (
                                          <span key={emp.userId || emp.email} className="m-assignee-badge">
                                            👤 {emp.name || 'Assignee'}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="m-unassigned-tag">Unassigned</span>
                                      )}
                                      <button
                                        type="button"
                                        className="btn-assign-sub"
                                        onClick={() =>
                                          setAssignModalTarget({
                                            type: 'milestone',
                                            project: proj,
                                            milestone: m,
                                          })
                                        }
                                      >
                                        Assign to Employee
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Row Action Controls */}
                                <div className="milestone-row-controls">
                                  <button
                                    type="button"
                                    className="btn-icon-action-sm"
                                    onClick={() =>
                                      setVoiceModalTarget({
                                        project: proj,
                                        milestone: m,
                                      })
                                    }
                                    title="Attach voice note to this milestone"
                                  >
                                    <MicIcon size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-icon-action-sm"
                                    onClick={() => handleOpenMilestoneModal(proj, m)}
                                    title="Edit milestone"
                                  >
                                    <EditIcon size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-icon-action-sm text-danger"
                                    onClick={() => handleDeleteMilestone(pId, mId)}
                                    title="Delete milestone"
                                  >
                                    <TrashIcon size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Concept Note AI Extractor */}
      <ConceptNoteModal
        isOpen={isConceptModalOpen}
        onClose={() => setIsConceptModalOpen(false)}
        onProjectCreated={() => {
          setIsConceptModalOpen(false);
          if (onProjectsUpdated) onProjectsUpdated();
        }}
      />

      {/* MODAL: Searchable Employee Assignment */}
      <SearchableEmployeeAssignModal
        isOpen={Boolean(assignModalTarget)}
        onClose={() => setAssignModalTarget(null)}
        initialSelectedIds={
          assignModalTarget?.type === 'project'
            ? (assignModalTarget?.project?.assignedEmployees || []).map((e) => e.userId)
            : (assignModalTarget?.milestone?.assignedTo || []).map((e) => e.userId)
        }
        title={
          assignModalTarget?.type === 'milestone'
            ? `Assign to Employee: ${assignModalTarget?.milestone?.title}`
            : `Assign to Employee: ${assignModalTarget?.project?.name}`
        }
        subtitle="Search and select one or multiple employees, interns, or team members."
        onConfirm={handleConfirmAssignment}
      />

      {/* MODAL: WhatsApp-Style Voice Recording */}
      <VoiceRecordingModal
        isOpen={Boolean(voiceModalTarget)}
        onClose={() => setVoiceModalTarget(null)}
        project={voiceModalTarget?.project}
        milestone={voiceModalTarget?.milestone}
        onSaveRecording={handleSaveRecording}
        onExtractMilestones={(extracted) => {
          setVoiceModalTarget(null);
          // Auto populate new milestone under project
          if (voiceModalTarget?.project && extracted.suggestedMilestones?.length > 0) {
            handleOpenMilestoneModal(voiceModalTarget.project, {
              title: extracted.suggestedMilestones[0].title,
              description: extracted.suggestedMilestones[0].description,
              deadline: extracted.suggestedMilestones[0].suggestedDeadline || '',
            });
          }
        }}
      />

      {/* MODAL: Add / Edit Milestone Underneath Project */}
      {milestoneModalTarget && (
        <div
          className="wa-assign-modal-overlay"
          onClick={() => setMilestoneModalTarget(null)}
        >
          <div
            className="wa-assign-modal-box animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px', width: '100%' }}
          >
            <div className="wa-assign-modal-header">
              <div className="wa-assign-header-title">
                <CheckCircleIcon size={20} className="text-primary" />
                <div>
                  <h3>
                    {milestoneModalTarget.milestoneToEdit
                      ? 'Edit Milestone'
                      : 'Add Milestone to Project'}
                  </h3>
                  <p>Under project: {milestoneModalTarget.project.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setMilestoneModalTarget(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveMilestone}>
              <div className="wa-assign-modal-body">
                <div className="form-group">
                  <label>Milestone Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Complete Backend API Architecture"
                    value={milestoneFormData.title}
                    onChange={(e) =>
                      setMilestoneFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Work Instructions / Deliverable Scope</label>
                  <textarea
                    rows={3}
                    placeholder="Detailed acceptance criteria, deliverables, and requirements..."
                    value={milestoneFormData.description}
                    onChange={(e) =>
                      setMilestoneFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Deadline / Due Date *</label>
                    <input
                      type="date"
                      value={milestoneFormData.deadline}
                      onChange={(e) =>
                        setMilestoneFormData((prev) => ({
                          ...prev,
                          deadline: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Phase / Sprint Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. Phase 1 or Sprint 2"
                      value={milestoneFormData.phase}
                      onChange={(e) =>
                        setMilestoneFormData((prev) => ({ ...prev, phase: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Initial Milestone Status</label>
                  <select
                    value={milestoneFormData.status}
                    onChange={(e) =>
                      setMilestoneFormData((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="submitted">Submitted for Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="wa-assign-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMilestoneModalTarget(null)}
                  disabled={milestoneSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={milestoneSaving}
                >
                  {milestoneSaving
                    ? 'Saving...'
                    : milestoneModalTarget.milestoneToEdit
                    ? 'Update Milestone'
                    : 'Add Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
