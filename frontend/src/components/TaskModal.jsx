import { useState } from 'react';
import { SparklesIcon, CornerDownRightIcon } from './Icons';

const TaskModalDialog = ({
  onClose,
  onSave,
  editingTask,
  projects,
  employees,
  defaultProjectId,
  parentTaskId,
}) => {
  const [formData, setFormData] = useState(() => {
    if (editingTask) {
      return {
        title: editingTask.title || '',
        description: editingTask.description || '',
        projectId: editingTask.projectId?._id || editingTask.projectId || defaultProjectId || '',
        parentTaskId: editingTask.parentTaskId || parentTaskId || null,
        assignedTo: editingTask.assignedTo?._id || editingTask.assignedTo || '',
        status: editingTask.status || 'not-started',
        priority: editingTask.priority || 'medium',
        weight: editingTask.weight || 1,
        deadline: editingTask.deadline || editingTask.dueDate || new Date().toISOString().split('T')[0],
      };
    }
    return {
      title: '',
      description: '',
      projectId: defaultProjectId || (projects.length > 0 ? (projects[0]._id || projects[0].id) : ''),
      parentTaskId: parentTaskId || null,
      assignedTo: employees.length > 0 ? (employees[0]._id || employees[0].id) : '',
      status: 'not-started',
      priority: 'medium',
      weight: 1,
      deadline: new Date().toISOString().split('T')[0],
    };
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    let assignedToName = 'Unassigned';
    if (formData.assignedTo) {
      const emp = employees.find((e) => (e._id || e.id) === formData.assignedTo);
      if (emp) {
        assignedToName = `${emp.firstName || emp.name} ${emp.lastName || ''}`.trim();
      }
    }

    onSave({
      ...formData,
      assignedToName,
      dueDate: formData.deadline,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px' }}
      >
        <div className="modal-header">
          <div className="modal-title-with-icon">
            {parentTaskId ? (
              <CornerDownRightIcon size={20} className="text-accent" />
            ) : (
              <SparklesIcon size={20} className="text-accent" />
            )}
            <h3>{editingTask ? 'Edit Task' : parentTaskId ? 'Create Subtask' : 'Create Task / Milestone'}</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <p className="modal-subtitle">
          {parentTaskId
            ? 'Assign a specific subtask to a team member to break down workload.'
            : 'Define task requirements, assign accountability, and set effort weights.'}
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="taskTitle">Task Title *</label>
            <input
              id="taskTitle"
              type="text"
              placeholder="e.g. Design responsive UI components"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taskProject">Associated Project</label>
              <select
                id="taskProject"
                value={formData.projectId}
                onChange={(e) => setFormData((prev) => ({ ...prev, projectId: e.target.value }))}
              >
                <option value="">Independent Task</option>
                {projects.map((p) => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="taskAssignedTo">Assign Subordinate *</label>
              <select
                id="taskAssignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData((prev) => ({ ...prev, assignedTo: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp._id || emp.id} value={emp._id || emp.id}>
                    {emp.firstName || emp.name} {emp.lastName || ''} ({emp.designation || emp.role?.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="taskDesc">Work Instructions & Deliverable Scope</label>
            <textarea
              id="taskDesc"
              rows={3}
              placeholder="Detailed instructions, acceptance criteria, or technical guidance..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taskDeadline">Completion Deadline *</label>
              <input
                id="taskDeadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="taskWeight">Task Effort Weight</label>
              <select
                id="taskWeight"
                value={formData.weight}
                onChange={(e) => setFormData((prev) => ({ ...prev, weight: Number(e.target.value) }))}
              >
                <option value={1}>1x — Standard Task</option>
                <option value={2}>2x — Moderate Effort</option>
                <option value={3}>3x — Heavy Milestone</option>
                <option value={5}>5x — Critical Epic</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taskPriority">Priority</label>
              <select
                id="taskPriority"
                value={formData.priority}
                onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="taskStatus">Initial Status</label>
              <select
                id="taskStatus"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="submitted">Submitted for Review</option>
                <option value="completed">Completed / Approved</option>
              </select>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingTask ? 'Save Changes' : parentTaskId ? 'Create Subtask' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const TaskModal = ({
  isOpen,
  onClose,
  onSave,
  editingTask = null,
  projects = [],
  employees = [],
  defaultProjectId = '',
  parentTaskId = null,
}) => {
  if (!isOpen) return null;

  return (
    <TaskModalDialog
      key={editingTask ? editingTask._id || editingTask.id : `new_${defaultProjectId}_${parentTaskId}`}
      onClose={onClose}
      onSave={onSave}
      editingTask={editingTask}
      projects={projects}
      employees={employees}
      defaultProjectId={defaultProjectId}
      parentTaskId={parentTaskId}
    />
  );
};
