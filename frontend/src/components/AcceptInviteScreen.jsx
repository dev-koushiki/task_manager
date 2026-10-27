import { useState, useEffect } from 'react';
import {
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  BuildingIcon,
  SparklesIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from './Icons';
import { api } from '../services/api';

export const AcceptInviteScreen = ({
  inviteToken,
  onAccountActivated,
  onGoToLogin,
}) => {
  const [inviteDetails, setInviteDetails] = useState(null);
  const [loading, setLoading] = useState(Boolean(inviteToken));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(() =>
    inviteToken ? '' : 'No invitation token provided in link.'
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [enableMfa, setEnableMfa] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;

    let ignore = false;
    const fetchDetails = async () => {
      try {
        const data = await api.getInviteDetails(inviteToken);
        if (!ignore) {
          setInviteDetails(data);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Invalid or expired invitation link.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      ignore = true;
    };
  }, [inviteToken]);

  const passwordsMatch = Boolean(password && confirmPassword && password === confirmPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please provide your password and confirmation.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.acceptInvite({
        inviteToken,
        password,
        confirmPassword,
        mfaEnabled: enableMfa,
      });

      onAccountActivated(res.user);
    } catch (err) {
      setError(err.message || 'Failed to activate employee account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="ambient-blob blob-1"></div>
      <div className="ambient-blob blob-2"></div>

      <div className="auth-card animate-slide-up">
        <div className="auth-nav">
          <button type="button" className="btn-back" onClick={onGoToLogin}>
            <ArrowLeftIcon size={16} />
            <span>Go to Login</span>
          </button>
          <span className="auth-step-pill">Secure Employee Onboarding</span>
        </div>

        <div className="auth-header">
          <div className="auth-icon-badge">
            <SparklesIcon size={20} className="text-accent" />
          </div>
          <h2 className="auth-title">Complete Your Account Setup</h2>
          <p className="auth-desc">
            You have received an authorized invitation to join{' '}
            <strong>{inviteDetails?.companyName || 'your organization'}</strong>.
          </p>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Validating single-use security token...</p>
          </div>
        ) : error && !inviteDetails ? (
          <div className="alert-box alert-error">
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Pre-locked Invitation Metadata Banner */}
            <div className="invite-summary-card">
              <div className="invite-badge-row">
                <span className="invite-role-badge">
                  Role: <strong>{inviteDetails?.role?.toUpperCase()}</strong>
                </span>
                <span className="invite-dept-badge">
                  <BuildingIcon size={12} /> {inviteDetails?.department}
                </span>
              </div>
              <div className="invite-user-info">
                <strong>{inviteDetails?.name}</strong>
                <span>{inviteDetails?.email}</span>
              </div>
              <small className="invite-locked-note">
                🔒 Your role and department have been pre-assigned by your workspace administrator.
              </small>
            </div>

            {error && <div className="alert-box alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {/* Password with Eye Icon */}
              <div className="form-group">
                <div className="label-with-hint">
                  <label htmlFor="empPwd">Create Password</label>
                  <span className="hint-text">Min 6 characters</span>
                </div>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <LockIcon size={18} />
                  </span>
                  <input
                    id="empPwd"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create your private password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="eye-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Decode / Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Decode / Show password'}
                  >
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password with Eye Icon */}
              <div className="form-group">
                <div className="label-with-hint">
                  <label htmlFor="empConfirmPwd">Confirm Password</label>
                  {passwordsMatch && (
                    <span className="hint-success">
                      <CheckIcon size={14} /> Passwords match
                    </span>
                  )}
                </div>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <LockIcon size={18} />
                  </span>
                  <input
                    id="empConfirmPwd"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="eye-toggle-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    title={showConfirmPassword ? 'Hide password' : 'Decode / Show password'}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Decode / Show password'}
                  >
                    {showConfirmPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              {/* MFA Configuration Checkbox matching Image 1 & 3 */}
              <div className="mfa-config-box">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enableMfa}
                    onChange={(e) => setEnableMfa(e.target.checked)}
                  />
                  <span>
                    <strong>Configure Multi-Factor Authentication (MFA)</strong>
                    <small>Requires a 6-digit one-time code during future logins.</small>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary btn-block glow-effect"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="spinner-wrap">
                    <span className="spinner"></span> Activating Account...
                  </span>
                ) : (
                  <span className="btn-label-icon">
                    <span>Activate Account & Access Workspace</span>
                    <ArrowRightIcon size={18} />
                  </span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
