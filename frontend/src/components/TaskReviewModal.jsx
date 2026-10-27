import { useState } from 'react';
import { CheckCircleIcon, AlertTriangleIcon, FileTextIcon } from './Icons';

export const TaskReviewModal = ({ isOpen, onClose, task, onReviewSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  const handleDecision = async (decision) => {
    try {
      setLoading(true);
      setError('');
      await onReviewSubmit(task._id || task.id, decision, feedback.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Review action failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px' }}
      >
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FileTextIcon size={20} className="text-accent" />
            <h3>Supervisor Quality Review</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <p className="modal-subtitle">
          Review subordinate deliverables. Verify quality before granting completion approval
          or returning with revision instructions.
        </p>

        {error && <div className="alert-box alert-error">{error}</div>}

        <div className="review-task-summary">
          <div className="review-row">
            <span className="review-label">Task Deliverable:</span>
            <strong className="review-value">{task.title}</strong>
          </div>
          <div className="review-row">
            <span className="review-label">Submitted By:</span>
            <span className="review-value">{task.assignedToName || 'Subordinate'}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Deadline:</span>
            <span className="review-value">{task.deadline || task.dueDate || 'Flexible'}</span>
          </div>
          {task.submissionNotes && (
            <div className="submission-notes-box">
              <span className="notes-heading">Employee Submission Notes:</span>
              <p>{task.submissionNotes}</p>
            </div>
          )}
          {task.blocker && (
            <div className="alert-box alert-error" style={{ margin: '8px 0 0' }}>
              <AlertTriangleIcon size={16} />
              <span>Flagged Blocker: {task.blocker}</span>
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label htmlFor="supervisorFeedback">Supervisor Feedback / Instructions:</label>
          <textarea
            id="supervisorFeedback"
            rows={3}
            placeholder="Add commendations or specific revision requirements..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        <div className="modal-actions review-actions-row" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={() => handleDecision('changes_requested')}
            disabled={loading}
          >
            <AlertTriangleIcon size={16} />
            <span>Return for Revision</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleDecision('approved')}
            disabled={loading}
          >
            <CheckCircleIcon size={16} />
            <span>Approve & Complete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
