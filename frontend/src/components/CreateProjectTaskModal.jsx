import { useState, useEffect } from 'react';
import {
  SparklesIcon,
  PlusIcon,
  TrashIcon,
  SearchIcon,
  CalendarIcon,
  UsersIcon,
  FolderIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from './Icons';
import { api } from '../services/api';

const DEPARTMENTS = [
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

const createEmptyMilestone = (defaultDeadline = '', defaultAssignee = '') => ({
  id: `ms_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
  title: '',
  assignedTo: defaultAssignee,
  deadline: defaultDeadline,
  weight: 1,
  priority: 'medium',
  status: 'not-started',
  description: '',
});

export const CreateProjectTaskModal = ({
  isOpen,
  onClose,
  onSuccess,
  defaultDepartment = 'General',
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [projectData, setProjectData] = useState({
    name: '',
    department: defaultDepartment,
    priority: 'medium',
    targetOutcome: '',
    startDate: today,
    targetCompletionDate: '',
    directorId: '',
    description: '',
    assignedEmployeeIds: [],
  });

  const [milestones, setMilestones] = useState([createEmptyMilestone('', '')]);
  const [eligibleDirectors, setEligibleDirectors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load directors and employee list
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    Promise.all([api.getEligibleDirectors(), api.getEmployees()])
      .then(([directors, emps]) => {
        if (!active) return;
        if (Array.isArray(directors)) {
          setEligibleDirectors(directors);
          if (directors.length > 0 && !projectData.directorId) {
            setProjectData((prev) => ({
              ...prev,
              directorId: directors[0]._id || directors[0].id,
            }));
          }
        }
        if (Array.isArray(emps)) {
          setEmployees(emps);
          // Set default assignee for milestone #1 if empty
          if (emps.length > 0) {
            setMilestones((prevMs) =>
              prevMs.map((m) =>
                m.assignedTo ? m : { ...m, assignedTo: emps[0]._id || emps[0].id }
              )
            );
          }
        }
      })
      .catch((err) => console.warn('Failed to load modal dependencies:', err.message));

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Project form field changes
  const handleProjectChange = (e) => {
    const { name, value } = e.target;
    setProjectData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');

    // If target completion date is updated, default milestone deadlines to it if not set
    if (name === 'targetCompletionDate') {
      setMilestones((prevMs) =>
        prevMs.map((m) => (!m.deadline ? { ...m, deadline: value } : m))
      );
    }
  };

  // Toggle employee in Project Team
  const handleToggleEmployee = (empId) => {
    const strId = String(empId);
    setProjectData((prev) => {
      const current = new Set(prev.assignedEmployeeIds.map((id) => String(id)));
      if (current.has(strId)) {
        current.delete(strId);
      } else {
        current.add(strId);
      }
      return { ...prev, assignedEmployeeIds: Array.from(current) };
    });
    if (error) setError('');
  };

  // Remove employee chip
  const handleRemoveEmployeeChip = (empId) => {
    const strId = String(empId);
    setProjectData((prev) => ({
      ...prev,
      assignedEmployeeIds: prev.assignedEmployeeIds.filter((id) => String(id) !== strId),
    }));
  };

  // Milestone field changes
  const handleMilestoneChange = (index, field, value) => {
    setMilestones((prevMs) => {
      const updated = [...prevMs];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-add employee to project team if assigned to a milestone
      if (field === 'assignedTo' && value) {
        setProjectData((prevProj) => {
          const strVal = String(value);
          const currentSet = new Set(prevProj.assignedEmployeeIds.map(String));
          if (!currentSet.has(strVal)) {
            currentSet.add(strVal);
            return { ...prevProj, assignedEmployeeIds: Array.from(currentSet) };
          }
          return prevProj;
        });
      }

      return updated;
    });
    if (error) setError('');
  };

  // Append new milestone
  const handleAddNewMilestone = () => {
    const defaultAssignee =
      projectData.assignedEmployeeIds.length > 0
        ? projectData.assignedEmployeeIds[0]
        : employees.length > 0
        ? employees[0]._id || employees[0].id
        : '';

    setMilestones((prev) => [
      ...prev,
      createEmptyMilestone(projectData.targetCompletionDate || today, defaultAssignee),
    ]);
  };

  // Remove milestone
  const handleRemoveMilestone = (index) => {
    if (milestones.length <= 1) return; // Keep at least one milestone
    setMilestones((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Validate Project Information
    if (!projectData.name.trim()) {
      setError('Project Name is required.');
      return;
    }
    if (!projectData.targetOutcome.trim()) {
      setError('Target Outcome / Objective is required.');
      return;
    }
    if (!projectData.targetCompletionDate) {
      setError('Target Completion Date is required.');
      return;
    }
    if (
      projectData.startDate &&
      projectData.targetCompletionDate &&
      projectData.startDate > projectData.targetCompletionDate
    ) {
      setError('Project Target Completion Date cannot be earlier than Start Date.');
      return;
    }
    if (!projectData.directorId) {
      setError('Please select a Responsible Project Director.');
      return;
    }

    // 2. Validate Milestones
    if (milestones.length === 0) {
      setError('At least one milestone deliverable must be created for the project.');
      return;
    }

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title.trim()) {
        setError(`Milestone #${i + 1} requires a milestone title.`);
        return;
      }
      if (!m.assignedTo) {
        setError(`Milestone #${i + 1} ("${m.title}") requires an assigned employee.`);
        return;
      }
      if (!m.deadline) {
        setError(`Milestone #${i + 1} ("${m.title}") requires a completion deadline.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError('');

      const sanitizedMilestones = milestones.map((m) => ({
        id: m.id,
        title: m.title.trim(),
        assignedTo: m.assignedTo || null,
        deadline: m.deadline || projectData.targetCompletionDate,
        dueDate: m.deadline || projectData.targetCompletionDate,
        weight: Math.max(1, Math.min(5, Number(m.weight) || 1)),
        priority: m.priority || 'medium',
        status: m.status || 'not-started',
        description: (m.description || '').trim(),
      }));

      const payload = {
        name: projectData.name.trim(),
        department: projectData.department,
        priority: projectData.priority,
        targetOutcome: projectData.targetOutcome.trim(),
        startDate: projectData.startDate,
        targetCompletionDate: projectData.targetCompletionDate,
        deadline: projectData.targetCompletionDate,
        directorId: projectData.directorId,
        description: projectData.description.trim(),
        assignedEmployeeIds: projectData.assignedEmployeeIds,
        milestones: sanitizedMilestones,
      };

      const result = await api.createProjectWithMilestones(payload);

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      console.error('Unified project/milestones creation failed:', err);
      setError(err.message || 'Failed to create project and milestones. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered employees for search
  const filteredEmployees = employees.filter((emp) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    const desig = (emp.designation || emp.role || '').toLowerCase();
    const empId = (emp.employeeId || '').toLowerCase();
    return fullName.includes(q) || dept.includes(q) || desig.includes(q) || empId.includes(q);
  });

  return (
    <div className="wa-assign-modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="wa-assign-modal-box unified-project-task-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="wa-assign-modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="wa-assign-header-title">
            <div className="unified-modal-header-badge">
              <SparklesIcon size={22} className="text-accent" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                Create Project & Assign Milestones
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Define project objectives, build your team and assign individual deliverables in one place.
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} disabled={isSubmitting}>
            &times;
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            className="unified-modal-scrollable-body"
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {error && (
              <div className="alert-box alert-error animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangleIcon size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* ========================================================
                SECTION 1: Project Information
                ======================================================== */}
            <div className="unified-form-section">
              <div className="unified-section-header">
                <div className="section-num-pill">1</div>
                <div>
                  <h3 className="unified-section-title">Project Information</h3>
                  <p className="unified-section-subtitle">Set high-level project goals, department alignment, and milestones target.</p>
                </div>
              </div>

              <div className="unified-section-content">
                {/* 1. Project Name */}
                <div className="form-group">
                  <label htmlFor="unifiedProjName">Project Name *</label>
                  <input
                    id="unifiedProjName"
                    name="name"
                    type="text"
                    placeholder="e.g. Website Development & Portal Migration"
                    value={projectData.name}
                    onChange={handleProjectChange}
                    required
                    autoFocus
                  />
                </div>

                {/* 2. Department & Priority */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="unifiedProjDept">Domain / Department *</label>
                    <select
                      id="unifiedProjDept"
                      name="department"
                      value={projectData.department}
                      onChange={handleProjectChange}
                      required
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="unifiedProjPriority">Project Priority</label>
                    <select
                      id="unifiedProjPriority"
                      name="priority"
                      value={projectData.priority}
                      onChange={handleProjectChange}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent / Critical</option>
                    </select>
                  </div>
                </div>

                {/* 3. Target Outcome / Objective */}
                <div className="form-group">
                  <label htmlFor="unifiedProjOutcome">Target Outcome / Objective *</label>
                  <input
                    id="unifiedProjOutcome"
                    name="targetOutcome"
                    type="text"
                    placeholder="e.g. Deploy next-gen responsive platform with sub-second latency"
                    value={projectData.targetOutcome}
                    onChange={handleProjectChange}
                    required
                  />
                </div>

                {/* 4. Start Date & Target Completion Date */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="unifiedProjStartDate">Project Start Date</label>
                    <input
                      id="unifiedProjStartDate"
                      name="startDate"
                      type="date"
                      value={projectData.startDate}
                      onChange={handleProjectChange}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="unifiedProjCompletionDate">Target Completion Date *</label>
                    <input
                      id="unifiedProjCompletionDate"
                      name="targetCompletionDate"
                      type="date"
                      value={projectData.targetCompletionDate}
                      onChange={handleProjectChange}
                      required
                    />
                  </div>
                </div>

                {/* 5. Responsible Project Director */}
                <div className="form-group">
                  <label htmlFor="unifiedProjDirector">Responsible Project Director *</label>
                  <select
                    id="unifiedProjDirector"
                    name="directorId"
                    value={projectData.directorId}
                    onChange={handleProjectChange}
                    required
                  >
                    <option value="">Select Project Director</option>
                    {eligibleDirectors.map((d) => (
                      <option key={d._id || d.id} value={d._id || d.id}>
                        {d.firstName} {d.lastName} ({d.designation || d.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Strategic Scope / Notes */}
                <div className="form-group">
                  <label htmlFor="unifiedProjNotes">Strategic Scope / Notes</label>
                  <textarea
                    id="unifiedProjNotes"
                    name="description"
                    rows={2}
                    placeholder="High-level milestones, stakeholder requirements, and architectural scope..."
                    value={projectData.description}
                    onChange={handleProjectChange}
                  />
                </div>
              </div>
            </div>

            {/* ========================================================
                SECTION 2: Project Team Assignment
                ======================================================== */}
            <div className="unified-form-section">
              <div className="unified-section-header">
                <div className="section-num-pill">2</div>
                <div>
                  <h3 className="unified-section-title">
                    Project Team Assignment{' '}
                    <span className="unified-team-counter">
                      ({projectData.assignedEmployeeIds.length} selected)
                    </span>
                  </h3>
                  <p className="unified-section-subtitle">
                    Select team members assigned to collaborate on this project. All selected employees become project members.
                  </p>
                </div>
              </div>

              <div className="unified-section-content">
                {/* Search Box */}
                <div className="unified-team-search-wrap">
                  <SearchIcon size={15} className="team-search-icon" />
                  <input
                    type="text"
                    className="unified-team-search-input"
                    placeholder="Search employees by name, ID or department..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                  />
                  {employeeSearch && (
                    <button
                      type="button"
                      className="team-search-clear"
                      onClick={() => setEmployeeSearch('')}
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Selected Chips */}
                {projectData.assignedEmployeeIds.length > 0 && (
                  <div className="unified-chips-container">
                    <span className="chips-label">Assigned Team:</span>
                    <div className="chips-list">
                      {projectData.assignedEmployeeIds.map((id) => {
                        const emp = employees.find((e) => String(e._id || e.id) === String(id));
                        if (!emp) return null;
                        return (
                          <div key={id} className="team-chip">
                            <span className="chip-name">
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span className="chip-desig">
                              ({emp.designation || emp.role})
                            </span>
                            <button
                              type="button"
                              className="chip-remove"
                              onClick={() => handleRemoveEmployeeChip(id)}
                              title="Remove from project team"
                            >
                              &times;
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Employees Selector */}
                <div className="assign-mini-selector" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                  {filteredEmployees.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0' }}>
                      No employees match your search criteria.
                    </p>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const empId = emp._id || emp.id;
                      const isChecked = projectData.assignedEmployeeIds.some(
                        (id) => String(id) === String(empId)
                      );
                      return (
                        <label
                          key={empId}
                          className={`assign-mini-pill ${isChecked ? 'selected' : ''}`}
                          style={{ cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEmployee(empId)}
                            style={{ display: 'none' }}
                          />
                          <span className="mini-pill-check">{isChecked ? '✓' : '+'}</span>
                          <span>
                            {emp.firstName} {emp.lastName}
                          </span>
                          <small>({emp.designation || emp.role})</small>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ========================================================
                SECTION 3: Project Milestones & Deliverables
                ======================================================== */}
            <div className="unified-form-section">
              <div className="unified-section-header">
                <div className="section-num-pill">3</div>
                <div>
                  <h3 className="unified-section-title">
                    Project Milestones & Deliverables{' '}
                    <span className="milestone-counter">
                      ({milestones.length} Milestone{milestones.length !== 1 ? 's' : ''} Added)
                    </span>
                  </h3>
                  <p className="unified-section-subtitle">
                    Break your project into individual deliverables, assign responsibilities and track their completion.
                  </p>
                </div>
              </div>

              <div className="unified-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {milestones.map((milestone, mIndex) => {
                  return (
                    <div key={milestone.id} className="unified-milestone-card animate-scale-up">
                      {/* Milestone Card Header */}
                      <div className="unified-milestone-header">
                        <div className="milestone-header-left">
                          <span className="milestone-number-badge">Milestone #{mIndex + 1}</span>
                          <span className="milestone-card-title-preview">
                            {milestone.title.trim() ? milestone.title : 'Untitled Deliverable'}
                          </span>
                        </div>
                        {milestones.length > 1 && (
                          <button
                            type="button"
                            className="btn-remove-milestone"
                            onClick={() => handleRemoveMilestone(mIndex)}
                            title="Remove this milestone"
                          >
                            <TrashIcon size={14} />
                            <span>Remove Milestone</span>
                          </button>
                        )}
                      </div>

                      {/* 1. Milestone Title */}
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>Milestone Title *</label>
                        <input
                          type="text"
                          placeholder="e.g. Design Dashboard UI"
                          value={milestone.title}
                          onChange={(e) => handleMilestoneChange(mIndex, 'title', e.target.value)}
                          required
                        />
                      </div>

                      {/* 2. Assignee & Deadline */}
                      <div className="form-row" style={{ marginBottom: '12px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Assign to Employee *</label>
                          <select
                            value={milestone.assignedTo}
                            onChange={(e) => handleMilestoneChange(mIndex, 'assignedTo', e.target.value)}
                            required
                          >
                            <option value="">-- Select Assignee --</option>
                            {/* Prioritize selected project team members */}
                            {projectData.assignedEmployeeIds.length > 0 && (
                              <optgroup label="⭐ Project Team Members">
                                {projectData.assignedEmployeeIds.map((id) => {
                                  const emp = employees.find(
                                    (e) => String(e._id || e.id) === String(id)
                                  );
                                  if (!emp) return null;
                                  return (
                                    <option key={id} value={id}>
                                      ⭐ {emp.firstName} {emp.lastName} ({emp.designation || emp.role})
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                            {/* All organization employees */}
                            <optgroup label="All Organization Employees">
                              {employees.map((emp) => {
                                const empId = emp._id || emp.id;
                                return (
                                  <option key={empId} value={empId}>
                                    {emp.firstName} {emp.lastName} ({emp.designation || emp.role})
                                  </option>
                                );
                              })}
                            </optgroup>
                          </select>
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Completion Deadline *</label>
                          <input
                            type="date"
                            value={milestone.deadline}
                            onChange={(e) => handleMilestoneChange(mIndex, 'deadline', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      {/* 3. Effort Weight, Priority & Initial Status */}
                      <div className="form-row" style={{ marginBottom: '12px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Milestone Effort Weight</label>
                          <select
                            value={milestone.weight}
                            onChange={(e) => handleMilestoneChange(mIndex, 'weight', e.target.value)}
                          >
                            <option value={1}>1x — Standard</option>
                            <option value={2}>2x — Moderate</option>
                            <option value={3}>3x — Complex</option>
                            <option value={4}>4x — High Complexity</option>
                            <option value={5}>5x — Critical / Highly Complex</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Priority</label>
                          <select
                            value={milestone.priority}
                            onChange={(e) => handleMilestoneChange(mIndex, 'priority', e.target.value)}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Critical</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Initial Status</label>
                          <select
                            value={milestone.status}
                            onChange={(e) => handleMilestoneChange(mIndex, 'status', e.target.value)}
                          >
                            <option value="not-started">Not Started</option>
                            <option value="in-progress">In Progress</option>
                          </select>
                        </div>
                      </div>

                      {/* 4. Description / Work Instructions */}
                      <div className="form-group">
                        <label>Description / Work Instructions</label>
                        <textarea
                          rows={2}
                          placeholder="Detailed instructions, acceptance criteria, or technical guidance for this deliverable..."
                          value={milestone.description}
                          onChange={(e) => handleMilestoneChange(mIndex, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* + Add Another Milestone Button */}
                <button
                  type="button"
                  className="btn-add-another-milestone"
                  onClick={handleAddNewMilestone}
                >
                  <PlusIcon size={16} />
                  <span>+ Add Another Milestone</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            className="wa-assign-modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'var(--bg-card)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ minWidth: '240px' }}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status" style={{ marginRight: '6px' }} />
                  <span>Creating Project & Milestones...</span>
                </>
              ) : (
                <>
                  <SparklesIcon size={16} style={{ marginRight: '6px' }} />
                  <span>Create Project & Assign Milestones</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CreateProjectMilestoneModal = CreateProjectTaskModal;
