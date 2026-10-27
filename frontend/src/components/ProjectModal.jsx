import { useState, useEffect } from 'react';
import { SparklesIcon } from './Icons';
import { api } from '../services/api';

const ProjectModalDialog = ({ onClose, onSave, editingProject }) => {
  const [formData, setFormData] = useState(() => ({
    name: editingProject?.name || '',
    targetOutcome: editingProject?.targetOutcome || '',
    description: editingProject?.description || '',
    directorId: editingProject?.directorId?._id || editingProject?.directorId || '',
    deadline: editingProject?.deadline || '',
    priority: editingProject?.priority || 'medium',
  }));

  const [eligibleDirectors, setEligibleDirectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getEligibleDirectors()
      .then((directors) => {
        if (active && Array.isArray(directors)) {
          setEligibleDirectors(directors);
          if (directors.length > 0 && !formData.directorId) {
            setFormData((prev) => ({
              ...prev,
              directorId: prev.directorId || directors[0]._id || directors[0].id,
            }));
          }
        }
      })
      .catch((err) => console.error('Failed to load eligible directors:', err));

    return () => {
      active = false;
    };
  }, [formData.directorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please provide a project name.');
      return;
    }
    if (!formData.directorId) {
      setError('Please designate a Project Director.');
      return;
    }
    if (!formData.deadline) {
      setError('Please set a project completion deadline.');
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save project.');
    } finally {
      setLoading(false);
    }
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
            <SparklesIcon size={20} className="text-accent" />
            <h3>{editingProject ? 'Edit Project' : 'Initialize New Project'}</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <p className="modal-subtitle">
          Define executive deliverables, set target completion date, and assign a responsible
          Project Director.
        </p>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
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

          <div className="form-row">
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
              <label htmlFor="deadline">Target Completion Date *</label>
              <input
                id="deadline"
                name="deadline"
                type="date"
                value={formData.deadline}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
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

            <div className="form-group">
              <label htmlFor="description">Strategic Scope / Notes</label>
              <input
                id="description"
                name="description"
                type="text"
                placeholder="High-level milestones & stakeholder requirements"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
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
              {loading ? 'Saving...' : editingProject ? 'Update Project' : 'Launch Project'}
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
