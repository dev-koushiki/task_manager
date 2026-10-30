import { useState } from 'react';
import { emailService } from '../services/emailService';
import { MailIcon, CheckIcon } from './Icons';

export const EmailConfigModal = ({ isOpen, onClose, onConfigSaved }) => {
  const [config, setConfig] = useState(() => emailService.getConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testEmail, setTestEmail] = useState('');

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    emailService.saveConfig(config);
    setSavedSuccess(true);
    if (onConfigSaved) onConfigSaved(config);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      alert('Please enter a test email address.');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      emailService.saveConfig(config);

      const res = await emailService.sendInviteEmail({
        toName: 'Koushiki Podder',
        toEmail: testEmail.trim(),
        inviteLink: `${window.location.origin}/?invite=test_invitation_preview`,
        companyName: 'TaskFlow',
        department: 'Engineering',
        role: 'employee',
      });

      setTestResult(res);
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Test send failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card animate-scale-up email-config-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <MailIcon size={20} className="text-accent" />
            <h3>Connect Your EmailJS Account</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <p className="modal-subtitle">
          Your EmailJS template <code>template_e8t3gmy</code> has been detected. Enter your Service ID and Public
          Key below to start delivering real invitation emails.
        </p>

        {savedSuccess && (
          <div className="alert-box alert-success animate-fade-in">
            <CheckIcon size={16} />
            <span>EmailJS credentials saved! Email delivery is now active.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="modal-form">
          {/* Service ID */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="serviceId">EmailJS Service ID *</label>
              <span className="hint-text">From left menu &gt; "Email Services"</span>
            </div>
            <input
              id="serviceId"
              type="text"
              placeholder="e.g. service_xxxxxxx"
              value={config.serviceId}
              onChange={(e) => setConfig({ ...config, serviceId: e.target.value })}
              required
              autoFocus
            />
          </div>

          {/* Template ID (prefilled from user's dashboard screenshot) */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="templateId">EmailJS Template ID *</label>
              <span className="hint-success">✓ Detected from your dashboard</span>
            </div>
            <input
              id="templateId"
              type="text"
              placeholder="template_e8t3gmy"
              value={config.templateId}
              onChange={(e) => setConfig({ ...config, templateId: e.target.value })}
              required
            />
          </div>

          {/* Public Key */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="publicKey">EmailJS Public Key *</label>
              <span className="hint-text">From left menu &gt; "Account" (API Keys)</span>
            </div>
            <input
              id="publicKey"
              type="text"
              placeholder="e.g. user_xxxxxxxxx or public_xxxxxxxxx"
              value={config.publicKey}
              onChange={(e) => setConfig({ ...config, publicKey: e.target.value })}
              required
            />
          </div>

          {/* Step-by-Step Instructions matching their screenshot */}
          <div className="emailjs-guide-box">
            <strong>Where to copy the remaining 2 keys from your EmailJS screen:</strong>
            <ol>
              <li>
                <strong>Service ID:</strong> Click <strong>Email Services</strong> on your left sidebar, then copy the Service ID shown next to your connected email.
              </li>
              <li>
                <strong>Template ID:</strong> Already pre-filled as <code>template_e8t3gmy</code> from your template!
              </li>
              <li>
                <strong>Public Key:</strong> Click <strong>Account</strong> on the bottom of the left sidebar, and copy your <strong>Public Key</strong>.
              </li>
            </ol>
          </div>

          {/* Test email section */}
          <div className="test-email-section">
            <label>Verify by Sending a Test Invitation Email:</label>
            <div className="test-email-row">
              <input
                type="email"
                placeholder="koushikipodder432@gmail.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestSend}
                disabled={testing}
              >
                {testing ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>

            {testResult && (
              <div
                className={`test-result-box ${
                  testResult.success ? 'test-success' : 'test-error'
                } animate-fade-in`}
              >
                {testResult.success
                  ? `✓ Real invitation email delivered to ${testEmail}! Check your inbox.`
                  : `✗ Error: ${testResult.message}`}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="btn btn-primary">
              Save & Activate Email Delivery
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
