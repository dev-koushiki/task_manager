import { useState } from 'react';
import {
  UserIcon,
  MailIcon,
  LockIcon,
  BuildingIcon,
  BriefcaseIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowLeftIcon,
  CheckIcon,
} from './Icons';
import { api } from '../services/api';

export const RegisterScreen = ({ onGoToLogin, onGoBackToWelcome, onRegisterSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    designation: '',
  });

  // State to decode/toggle password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const passwordsMatch =
    Boolean(formData.password &&
    formData.confirmPassword &&
    formData.password === formData.confirmPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.companyName.trim() ||
      !formData.designation.trim()
    ) {
      setError('Please fill in all the required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        companyName: formData.companyName.trim(),
        designation: formData.designation.trim(),
      });

      // User asked: "then create acc then login and then their expected dashboard will apear."
      // Trigger callback with registered details
      onRegisterSuccess(res.user, formData.email, 'Account created successfully! Please log in to open your dashboard.');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="ambient-blob blob-1"></div>
      <div className="ambient-blob blob-2"></div>

      <div className="auth-card animate-slide-up">
        {/* Navigation header */}
        <div className="auth-nav">
          <button
            type="button"
            className="btn-back"
            onClick={onGoBackToWelcome}
            title="Back to Welcome Screen"
          >
            <ArrowLeftIcon size={16} />
            <span>Welcome</span>
          </button>
          <span className="auth-step-pill">Step 1 of 2: Registration</span>
        </div>

        <div className="auth-header">
          <h2 className="auth-title">Create Your Account</h2>
          <p className="auth-desc">
            Enter your professional details to join Taskflow and start managing tasks.
          </p>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* First Name & Last Name */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <UserIcon size={18} />
                </span>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="e.g. John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <UserIcon size={18} />
                </span>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="e.g. Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Mail ID */}
          <div className="form-group">
            <label htmlFor="email">Mail ID (Email Address)</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <MailIcon size={18} />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Company Name & Designation */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="companyName">Company Name</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <BuildingIcon size={18} />
                </span>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="e.g. TechCorp Solutions"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="designation">Designation</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <BriefcaseIcon size={18} />
                </span>
                <input
                  id="designation"
                  name="designation"
                  type="text"
                  placeholder="e.g. Lead Project Manager"
                  value={formData.designation}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Password with Eye Icon to decode */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="password">Password</label>
              <span className="hint-text">Min 6 characters</span>
            </div>
            <div className="input-wrapper">
              <span className="input-icon">
                <LockIcon size={18} />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
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

          {/* Confirm Password with Eye Icon to decode */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="confirmPassword">Confirm Password</label>
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
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
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

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary btn-block glow-effect"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-wrap">
                <span className="spinner"></span> Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer switch to login */}
        <div className="auth-footer">
          <span>Already have an account?</span>
          <button type="button" className="link-btn" onClick={onGoToLogin}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
