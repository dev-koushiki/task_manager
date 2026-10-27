import { useState } from 'react';
import { SparklesIcon, CheckCircleIcon } from './Icons';

export const SubmitWorkModal = ({ isOpen, onClose, task, onSubmitWork }) => {
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await onSubmitWork(task._id || task.id, submissionNotes.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit work for review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px' }}
      >
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <CheckCircleIcon size={20} className="text-success" />
            <h3>Submit Deliverable for Review</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <p className="modal-subtitle">
          Ready to submit <strong>{task.title}</strong>? Your supervisor will be notified
          to inspect deliverables and grant final completion sign-off.
        </p>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="submissionNotes">Submission Notes / Deliverable Summary:</label>
            <textarea
              id="submissionNotes"
              rows={4}
              placeholder="Describe what was accomplished, deployment links, repo branch, or verification tests..."
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              required
            />
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
              <SparklesIcon size={16} />
              <span>{loading ? 'Submitting...' : 'Submit for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
