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

const createEmptyTask = (defaultDeadline = '', defaultAssignee = '') => ({
  id: `task_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
  title: '',
  assignedTo: defaultAssignee,
  description: '',
  deadline: defaultDeadline,
  weight: 1,
  priority: 'medium',
  status: 'not-started',
  milestones: [],
  milestoneInput: '',
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

  const [tasks, setTasks] = useState([createEmptyTask('', '')]);
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
          // Set default assignee for task #1 if empty
          if (emps.length > 0) {
            setTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.assignedTo ? t : { ...t, assignedTo: emps[0]._id || emps[0].id }
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

    // If target completion date is updated, default task deadlines to it if not set
    if (name === 'targetCompletionDate') {
      setTasks((prevTasks) =>
        prevTasks.map((t) => (!t.deadline ? { ...t, deadline: value } : t))
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

  // Task field changes
  const handleTaskChange = (index, field, value) => {
    setTasks((prevTasks) => {
      const updated = [...prevTasks];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-add employee to project team if assigned to a task
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

  // Milestone management per task
  const handleAddMilestone = (taskIndex) => {
    const currentTask = tasks[taskIndex];
    const text = (currentTask.milestoneInput || '').trim();
    if (!text) return;

    // Check duplicate milestone in this task
    if (currentTask.milestones.some((m) => m.title.toLowerCase() === text.toLowerCase())) {
      setError(`Milestone "${text}" is already added to Task #${taskIndex + 1}.`);
      return;
    }

    setTasks((prevTasks) => {
      const updated = [...prevTasks];
      const newMilestone = {
        id: `ms_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: text,
        completed: false,
      };
      updated[taskIndex] = {
        ...updated[taskIndex],
        milestones: [...updated[taskIndex].milestones, newMilestone],
        milestoneInput: '',
      };
      return updated;
    });
    if (error) setError('');
  };

  const handleRemoveMilestone = (taskIndex, milestoneIndex) => {
    setTasks((prevTasks) => {
      const updated = [...prevTasks];
      updated[taskIndex] = {
        ...updated[taskIndex],
        milestones: updated[taskIndex].milestones.filter((_, idx) => idx !== milestoneIndex),
      };
      return updated;
    });
  };

  // Append new task
  const handleAddNewTask = () => {
    const defaultAssignee =
      projectData.assignedEmployeeIds.length > 0
        ? projectData.assignedEmployeeIds[0]
        : employees.length > 0
        ? employees[0]._id || employees[0].id
        : '';

    setTasks((prev) => [
      ...prev,
      createEmptyTask(projectData.targetCompletionDate || today, defaultAssignee),
    ]);
  };

  // Remove additional task
  const handleRemoveTask = (index) => {
    if (tasks.length <= 1) return; // Keep at least one task
    setTasks((prev) => prev.filter((_, idx) => idx !== index));
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

    // 2. Validate Tasks
    if (tasks.length === 0) {
      setError('At least one task must be created for the project.');
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t.title.trim()) {
        setError(`Task #${i + 1} requires a task title.`);
        return;
      }
      if (!t.deadline) {
        setError(`Task #${i + 1} ("${t.title}") requires a completion deadline.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError('');

      // Auto-flush any unsubmitted milestone input
      const finalTasks = tasks.map((t) => {
        let ms = [...t.milestones];
        if (t.milestoneInput && t.milestoneInput.trim()) {
          const trimmed = t.milestoneInput.trim();
          if (!ms.some((m) => m.title.toLowerCase() === trimmed.toLowerCase())) {
            ms.push({
              id: `ms_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              title: trimmed,
              completed: false,
            });
          }
        }
        return {
          title: t.title.trim(),
          assignedTo: t.assignedTo || null,
          description: t.description.trim(),
          deadline: t.deadline,
          weight: Number(t.weight) || 1,
          priority: t.priority || 'medium',
          status: t.status || 'not-started',
          milestones: ms,
        };
      });

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
        tasks: finalTasks,
      };

      const result = await api.createProjectWithTasks(payload);

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      console.error('Unified project/task creation failed:', err);
      setError(err.message || 'Failed to create project and tasks. Please try again.');
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
                Create Project & Assign Tasks
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Define project objectives, build your team and assign deliverables in one place.
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
                    Select team members assigned to collaborate on this project. They can be assigned project tasks below.
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
                SECTION 3 & 4: Task Information & Milestones
                ======================================================== */}
            <div className="unified-form-section">
              <div className="unified-section-header">
                <div className="section-num-pill">3</div>
                <div>
                  <h3 className="unified-section-title">
                    Task Deliverables & Milestones{' '}
                    <span className="unified-team-counter">
                      ({tasks.length} task{tasks.length > 1 ? 's' : ''})
                    </span>
                  </h3>
                  <p className="unified-section-subtitle">
                    Define project tasks, assign them to team members, and add independent completion milestones.
                  </p>
                </div>
              </div>

              <div className="unified-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {tasks.map((task, tIndex) => {
                  return (
                    <div key={task.id} className="unified-task-card animate-scale-up">
                      {/* Task Card Header */}
                      <div className="unified-task-header">
                        <div className="task-header-left">
                          <span className="task-number-badge">Task #{tIndex + 1}</span>
                          <span className="task-card-title-preview">
                            {task.title.trim() ? task.title : 'Untitled Deliverable'}
                          </span>
                        </div>
                        {tasks.length > 1 && (
                          <button
                            type="button"
                            className="btn-remove-task"
                            onClick={() => handleRemoveTask(tIndex)}
                            title="Remove this task"
                          >
                            <TrashIcon size={14} />
                            <span>Remove Task</span>
                          </button>
                        )}
                      </div>

                      {/* 1. Task Title */}
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>Task Title *</label>
                        <input
                          type="text"
                          placeholder="e.g. Design responsive UI components & interactive states"
                          value={task.title}
                          onChange={(e) => handleTaskChange(tIndex, 'title', e.target.value)}
                          required
                        />
                      </div>

                      {/* 2. Assignee & Deadline */}
                      <div className="form-row" style={{ marginBottom: '12px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Assign to Employee *</label>
                          <select
                            value={task.assignedTo}
                            onChange={(e) => handleTaskChange(tIndex, 'assignedTo', e.target.value)}
                            required
                          >
                            <option value="">-- Select Assignee --</option>
                            {/* Prioritize selected project team members */}
                            {projectData.assignedEmployeeIds.length > 0 && (
                              <optgroup label="Project Team Members">
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
                            {/* Other available employees */}
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
                            value={task.deadline}
                            onChange={(e) => handleTaskChange(tIndex, 'deadline', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      {/* 3. Effort Weight, Priority & Initial Status */}
                      <div className="form-row" style={{ marginBottom: '12px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Task Effort Weight</label>
                          <select
                            value={task.weight}
                            onChange={(e) => handleTaskChange(tIndex, 'weight', e.target.value)}
                          >
                            <option value={1}>1x — Standard Task</option>
                            <option value={2}>2x — Moderate Task</option>
                            <option value={3}>3x — Complex Task</option>
                            <option value={4}>4x — High Complexity</option>
                            <option value={5}>5x — Critical / Highly Complex Task</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Priority</label>
                          <select
                            value={task.priority}
                            onChange={(e) => handleTaskChange(tIndex, 'priority', e.target.value)}
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
                            value={task.status}
                            onChange={(e) => handleTaskChange(tIndex, 'status', e.target.value)}
                          >
                            <option value="not-started">Not Started</option>
                            <option value="in-progress">In Progress</option>
                          </select>
                        </div>
                      </div>

                      {/* 4. Work Instructions */}
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label>Work Instructions & Deliverable Scope</label>
                        <textarea
                          rows={2}
                          placeholder="Detailed instructions, acceptance criteria, or technical guidance..."
                          value={task.description}
                          onChange={(e) => handleTaskChange(tIndex, 'description', e.target.value)}
                        />
                      </div>

                      {/* SECTION 4: Independent Milestones */}
                      <div className="task-milestones-box">
                        <label className="milestones-box-label">
                          Milestones (Independent completion deliverables)
                        </label>

                        <div className="milestone-add-row">
                          <input
                            type="text"
                            placeholder="e.g. Draft initial mockups & wireframes"
                            value={task.milestoneInput || ''}
                            onChange={(e) => handleTaskChange(tIndex, 'milestoneInput', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddMilestone(tIndex);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAddMilestone(tIndex)}
                          >
                            <PlusIcon size={13} />
                            <span>Add</span>
                          </button>
                        </div>

                        {task.milestones && task.milestones.length > 0 && (
                          <div className="milestones-items-list">
                            {task.milestones.map((m, mIdx) => (
                              <div key={m.id || mIdx} className="milestone-item-row">
                                <span className="ms-status-indicator">○</span>
                                <span className="ms-item-title">{m.title}</span>
                                <button
                                  type="button"
                                  className="btn-trash-ms"
                                  onClick={() => handleRemoveMilestone(tIndex, mIdx)}
                                  title="Remove milestone"
                                >
                                  <TrashIcon size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* SECTION 5: Additional Task Creation Button */}
                <button
                  type="button"
                  className="btn-add-another-task"
                  onClick={handleAddNewTask}
                >
                  <PlusIcon size={16} />
                  <span>+ Add Another Task</span>
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
              style={{ minWidth: '220px' }}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status" style={{ marginRight: '6px' }} />
                  <span>Creating Project & Tasks...</span>
                </>
              ) : (
                <>
                  <SparklesIcon size={16} style={{ marginRight: '6px' }} />
                  <span>Create Project & Assign Tasks</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
