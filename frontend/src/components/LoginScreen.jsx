import { useState } from 'react';
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowLeftIcon,
  SparklesIcon,
  CheckIcon,
} from './Icons';
import { api } from '../services/api';

export const LoginScreen = ({
  initialEmail = '',
  successNotice = '',
  onGoToRegister,
  onGoBackToWelcome,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login({ email: email.trim(), password });
      if (res.requireMfa) {
        setIsMfaRequired(true);
        setError('');
      } else {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!mfaCode.trim() || mfaCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.verifyMfa(email.trim(), mfaCode.trim());
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'MFA verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="ambient-blob blob-1"></div>
      <div className="ambient-blob blob-3"></div>

      <div className="auth-card animate-slide-up">
        {/* Navigation header */}
        <div className="auth-nav">
          <button
            type="button"
            className="btn-back"
            onClick={isMfaRequired ? () => setIsMfaRequired(false) : onGoBackToWelcome}
            title="Back"
          >
            <ArrowLeftIcon size={16} />
            <span>{isMfaRequired ? 'Back to Credentials' : 'Welcome'}</span>
          </button>
          <span className="auth-step-pill">
            {isMfaRequired ? 'Security: 2FA Verification' : 'Secure Login'}
          </span>
        </div>

        <div className="auth-header">
          <div className="auth-icon-badge">
            <SparklesIcon size={20} className="text-accent" />
          </div>
          <h2 className="auth-title">
            {isMfaRequired ? 'Multi-Factor Authentication' : 'Welcome Back'}
          </h2>
          <p className="auth-desc">
            {isMfaRequired
              ? `Enter the 6-digit verification code sent for ${email}`
              : 'Sign in to access your authorized workspace dashboard.'}
          </p>
        </div>

        {/* Success alert notice */}
        {successNotice && !isMfaRequired && (
          <div className="alert-box alert-success animate-fade-in">
            {successNotice}
          </div>
        )}

        {/* Error alert */}
        {error && <div className="alert-box alert-error">{error}</div>}

        {isMfaRequired ? (
          /* MFA Step */
          <form onSubmit={handleMfaSubmit} className="auth-form" noValidate>
            <div className="form-group text-center">
              <label htmlFor="mfaInput">6-Digit Security Code</label>
              <input
                id="mfaInput"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="mfa-pin-input"
                autoFocus
                required
              />
              <span className="hint-text mt-1">Enter any 6 digits (e.g. 123456)</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block glow-effect"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-wrap">
                  <span className="spinner"></span> Verifying...
                </span>
              ) : (
                <span className="btn-label-icon">
                  <CheckIcon size={18} />
                  <span>Verify Code & Continue</span>
                </span>
              )}
            </button>
          </form>
        ) : (
          /* Standard Email & Password Step */
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Mail ID */}
            <div className="form-group">
              <label htmlFor="loginEmail">Official Mail ID</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <MailIcon size={18} />
                </span>
                <input
                  id="loginEmail"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  required
                />
              </div>
            </div>

            {/* Password with Eye Icon */}
            <div className="form-group">
              <div className="label-with-hint">
                <label htmlFor="loginPassword">Password</label>
              </div>
              <div className="input-wrapper">
                <span className="input-icon">
                  <LockIcon size={18} />
                </span>
                <input
                  id="loginPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
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

            {/* Sign In Button */}
            <button
              type="submit"
              className="btn btn-primary btn-block glow-effect"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-wrap">
                  <span className="spinner"></span> Signing In...
                </span>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </form>
        )}

        {/* Footer switch to registration */}
        <div className="auth-footer">
          <span>Register a new company workspace?</span>
          <button type="button" className="link-btn" onClick={onGoToRegister}>
            Admin Registration
          </button>
        </div>
      </div>
    </div>
  );
};
