import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  FileTextIcon,
  MessageSquareIcon,
  SendIcon,
  UserIcon,
  ClockIcon,
} from './Icons';
import { api } from '../services/api';

export const TaskReviewModal = ({ isOpen, onClose, task, onReviewSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentsList, setCommentsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Synchronize and load task review comments
  useEffect(() => {
    if (task && isOpen) {
      setError('');
      setNotice('');
      setFeedback('');
      setNewComment('');

      // Initialize with task comments if available
      if (Array.isArray(task.reviewComments) && task.reviewComments.length > 0) {
        setCommentsList(task.reviewComments);
      } else {
        setCommentsList([]);
      }

      // Fetch latest review comments and history from backend
      const taskId = task._id || task.id;
      if (taskId) {
        api.getTaskReviews(taskId)
          .then((res) => {
            if (res && Array.isArray(res.reviewComments)) {
              setCommentsList(res.reviewComments);
            }
          })
          .catch((err) => {
            console.warn('Could not load review comments:', err.message);
          });
      }
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleDecision = async (decision) => {
    try {
      setLoading(true);
      setError('');
      setNotice('');
      const combinedFeedback = feedback.trim() || newComment.trim();
      await onReviewSubmit(task._id || task.id, decision, combinedFeedback);
      onClose();
    } catch (err) {
      setError(err.message || 'Review action failed.');
    } finally {
      setLoading(false);
    }
  };

  // Post mid-review comment directly to employee dashboard
  const handleSendComment = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || commentSubmitting) return;

    try {
      setCommentSubmitting(true);
      setError('');
      setNotice('');

      const res = await api.addReviewComment(task._id || task.id, trimmed);
      const addedComment = res.comment || {
        _id: `cmt_${Date.now()}`,
        authorName: 'Supervisor',
        authorRole: 'Reviewer',
        comment: trimmed,
        decision: 'comment',
        createdAt: new Date().toISOString(),
      };

      setCommentsList((prev) => [...prev, addedComment]);
      setNewComment('');
      setNotice('Review comment sent to employee dashboard!');
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to send review comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const formatCommentDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card review-modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
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
          Review subordinate deliverables, communicate feedback to the employee dashboard, and approve completion or return with revision instructions.
        </p>

        {error && <div className="alert-box alert-error">{error}</div>}
        {notice && <div className="alert-box alert-success">{notice}</div>}

        <div className="modal-scrollable-content" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {/* Deliverable Summary */}
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

          {/* ================= COMMENT SECTION ================= */}
          <div className="review-comments-section" style={{ marginTop: '20px' }}>
            <div className="section-subheading-row">
              <div className="row-title-with-icon">
                <MessageSquareIcon size={16} className="text-primary" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                  Review Comments & Instructions (Sent to Employee Dashboard)
                </h4>
              </div>
              <span className="comments-count-pill">{commentsList.length} Comments</span>
            </div>

            {/* Comment Thread List */}
            <div className="review-comments-thread">
              {commentsList.length === 0 ? (
                <div className="comments-empty-notice">
                  <p>No review comments yet. Enter instructions or notes below to send them to the employee dashboard.</p>
                </div>
              ) : (
                <div className="comments-bubble-list">
                  {commentsList.map((c, i) => {
                    const isDecision = c.decision === 'approved' || c.decision === 'changes_requested';
                    const isApproved = c.decision === 'approved';
                    const isReply = c.decision === 'reply';

                    return (
                      <div
                        key={c._id || i}
                        className={`review-comment-bubble ${
                          isApproved ? 'bubble-approved' : isDecision ? 'bubble-revision' : isReply ? 'bubble-reply' : 'bubble-supervisor'
                        }`}
                      >
                        <div className="bubble-header">
                          <div className="author-info">
                            <div className="author-avatar-sm">
                              {c.authorName ? c.authorName[0].toUpperCase() : 'U'}
                            </div>
                            <span className="author-name">{c.authorName || 'Reviewer'}</span>
                            <span className="author-role-tag">
                              {c.authorRole || (isReply ? 'Assignee' : 'Supervisor')}
                            </span>
                          </div>
                          <span className="comment-time">
                            <ClockIcon size={12} /> {formatCommentDate(c.createdAt)}
                          </span>
                        </div>
                        <div className="bubble-content">
                          {c.comment}
                        </div>
                        {isDecision && (
                          <div className={`decision-badge-pill ${isApproved ? 'badge-approved' : 'badge-revision'}`}>
                            {isApproved ? 'Approved & Completed' : 'Revision Requested'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Post Comment Input Box */}
            <div className="post-review-comment-card" style={{ marginTop: '12px' }}>
              <label htmlFor="reviewCommentInput" className="comment-input-label">
                Add Review Comment or Guidance for Employee:
              </label>
              <textarea
                id="reviewCommentInput"
                rows={3}
                placeholder="Type revision requirements, instructions, or notes for the employee dashboard..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="review-comment-textarea"
              />
              <div className="post-comment-btn-row">
                <span className="help-text-hint">
                  Comments appear immediately on the employee's dashboard deliverable card.
                </span>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm btn-send-comment"
                  onClick={handleSendComment}
                  disabled={!newComment.trim() || commentSubmitting}
                >
                  <SendIcon size={14} />
                  <span>{commentSubmitting ? 'Sending...' : 'Send Comment to Employee Dashboard'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Decision Actions */}
        <div className="modal-actions review-actions-row" style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
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
            title="Return task deliverable back to employee with revision instructions"
          >
            <AlertTriangleIcon size={16} />
            <span>Return for Revision</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleDecision('approved')}
            disabled={loading}
            title="Approve deliverable and mark task as completed"
          >
            <CheckCircleIcon size={16} />
            <span>Approve & Complete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
