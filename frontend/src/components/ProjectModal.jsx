import { useState, useEffect } from 'react';
import { SparklesIcon, CalendarIcon, UsersIcon } from './Icons';
import { api } from '../services/api';

const ProjectModalDialog = ({ onClose, onSave, editingProject }) => {
  const [formData, setFormData] = useState(() => ({
    name: editingProject?.name || '',
    targetOutcome: editingProject?.targetOutcome || '',
    description: editingProject?.description || '',
    department: editingProject?.department || 'General',
    directorId: editingProject?.directorId?._id || editingProject?.directorId || '',
    startDate: editingProject?.startDate || '',
    targetCompletionDate: editingProject?.targetCompletionDate || editingProject?.deadline || '',
    deadline: editingProject?.targetCompletionDate || editingProject?.deadline || '',
    priority: editingProject?.priority || 'medium',
    assignedEmployeeIds: (editingProject?.assignedEmployees || []).map((e) => e.userId),
  }));

  const [eligibleDirectors, setEligibleDirectors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const departments = [
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

  useEffect(() => {
    let active = true;

    Promise.all([api.getEligibleDirectors(), api.getEmployees()])
      .then(([directors, emps]) => {
        if (!active) return;
        if (Array.isArray(directors)) {
          setEligibleDirectors(directors);
          if (directors.length > 0 && !formData.directorId) {
            setFormData((prev) => ({
              ...prev,
              directorId: prev.directorId || directors[0]._id || directors[0].id,
            }));
          }
        }
        if (Array.isArray(emps)) {
          setEmployees(emps);
        }
      })
      .catch((err) => console.error('Failed to load project dependencies:', err));

    return () => {
      active = false;
    };
  }, [formData.directorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'targetCompletionDate') {
        next.deadline = value;
      }
      return next;
    });
    if (error) setError('');
  };

  const handleToggleEmployee = (empId) => {
    setFormData((prev) => {
      const current = new Set(prev.assignedEmployeeIds.map((id) => String(id)));
      const strId = String(empId);
      if (current.has(strId)) {
        current.delete(strId);
      } else {
        current.add(strId);
      }
      return { ...prev, assignedEmployeeIds: Array.from(current) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please provide a project name.');
      return;
    }
    if (!formData.targetCompletionDate && !formData.deadline) {
      setError('Please set a Target Completion Date.');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        ...formData,
        deadline: formData.targetCompletionDate || formData.deadline,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wa-assign-modal-overlay" onClick={onClose}>
      <div
        className="wa-assign-modal-box animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh' }}
      >
        <div className="wa-assign-modal-header">
          <div className="wa-assign-header-title">
            <SparklesIcon size={20} className="text-accent" />
            <div>
              <h3>{editingProject ? 'Edit Project' : 'Initialize New Project'}</h3>
              <p>Define project objectives, dates, department domain, and assign employees.</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="wa-assign-modal-body" style={{ maxHeight: '66vh', overflowY: 'auto' }}>
            {error && <div className="alert-box alert-error" style={{ marginBottom: '12px' }}>{error}</div>}

            <div className="form-group">
              <label htmlFor="projName">Project Name *</label>
              <input
                id="projName"
                name="name"
                type="text"
                placeholder="e.g. Website Development & Portal Migration"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="projDept">Domain / Department *</label>
                <select
                  id="projDept"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="priority">Project Priority</label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="targetOutcome">Target Outcome / Objective *</label>
              <input
                id="targetOutcome"
                name="targetOutcome"
                type="text"
                placeholder="e.g. Deploy next-gen responsive platform with sub-second latency"
                value={formData.targetOutcome}
                onChange={handleChange}
                required
              />
            </div>

            {/* Requirement E: Project Start Date & Target Completion Date */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startDate">Project Start Date</label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="targetCompletionDate">Target Completion Date *</label>
                <input
                  id="targetCompletionDate"
                  name="targetCompletionDate"
                  type="date"
                  value={formData.targetCompletionDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="directorId">Responsible Project Director *</label>
              <select
                id="directorId"
                name="directorId"
                value={formData.directorId}
                onChange={handleChange}
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

            <div className="form-group">
              <label htmlFor="description">Strategic Scope / Notes</label>
              <textarea
                id="description"
                name="description"
                rows={2}
                placeholder="High-level milestones & stakeholder requirements..."
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            {/* Requirement B: Assign to Employee selection preview */}
            <div className="form-group">
              <label>Assign to Employee ({formData.assignedEmployeeIds.length} selected)</label>
              <div className="assign-mini-selector">
                {employees.map((emp) => {
                  const empId = emp._id || emp.id;
                  const isChecked = formData.assignedEmployeeIds.some((id) => String(id) === String(empId));
                  return (
                    <label
                      key={empId}
                      className={`assign-mini-pill ${isChecked ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleEmployee(empId)}
                        style={{ display: 'none' }}
                      />
                      <span className="mini-pill-check">{isChecked ? '✓' : '+'}</span>
                      <span>{emp.firstName} {emp.lastName}</span>
                      <small>({emp.designation || emp.role})</small>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="wa-assign-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ProjectModal = ({ isOpen, onClose, onSave, editingProject = null }) => {
  if (!isOpen) return null;

  return (
    <ProjectModalDialog
      key={editingProject ? editingProject._id || editingProject.id : 'new_project'}
      onClose={onClose}
      onSave={onSave}
      editingProject={editingProject}
    />
  );
};
