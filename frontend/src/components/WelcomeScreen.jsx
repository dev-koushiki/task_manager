import { useState, useEffect } from 'react';
import { SparklesIcon, ArrowRightIcon, LayersIcon, UsersIcon, CheckIcon } from './Icons';

export const WelcomeScreen = ({ onGetStarted, onGoToLogin }) => {
  const [secondsLeft, setSecondsLeft] = useState(6);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    if (secondsLeft <= 0) {
      onGetStarted();
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isPaused, onGetStarted]);

  return (
    <div
      className="welcome-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background ambient glowing shapes */}
      <div className="ambient-blob blob-1"></div>
      <div className="ambient-blob blob-2"></div>
      <div className="ambient-blob blob-3"></div>

      <div className="welcome-card animate-scale-up">
        {/* Top badge */}
        <div className="brand-badge animate-bounce-gentle">
          <SparklesIcon size={16} className="text-accent" />
          <span>Next-Gen Task Management Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="welcome-title">
          Organize, Collaborate, & <br />
          <span className="text-gradient">Achieve With Precision</span>
        </h1>

        {/* Subtitle */}
        <p className="welcome-subtitle">
          Empower your organization with seamless role designation, real-time task workflows,
          and transparent team progress tracking in one unified hub.
        </p>

        {/* Feature Highlights Grid */}
        <div className="welcome-features">
          <div className="feature-pill animate-fade-in delay-1">
            <div className="feature-icon-wrapper bg-purple">
              <LayersIcon size={18} />
            </div>
            <div>
              <strong>Structured Workflows</strong>
              <p>Kanban & task tracking</p>
            </div>
          </div>

          <div className="feature-pill animate-fade-in delay-2">
            <div className="feature-icon-wrapper bg-blue">
              <UsersIcon size={18} />
            </div>
            <div>
              <strong>Role & Team Sync</strong>
              <p>Designation & hierarchy</p>
            </div>
          </div>

          <div className="feature-pill animate-fade-in delay-3">
            <div className="feature-icon-wrapper bg-emerald">
              <CheckIcon size={18} />
            </div>
            <div>
              <strong>Instant Visibility</strong>
              <p>Milestone progress KPIs</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="welcome-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg glow-effect"
            onClick={onGetStarted}
          >
            <span>Get Started & Create Account</span>
            <ArrowRightIcon size={20} />
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={onGoToLogin}
          >
            Sign In to Existing Account
          </button>
        </div>

        {/* Auto transition progress bar */}
        <div className="auto-redirect-box">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${((6 - secondsLeft) / 6) * 100}%` }}
            ></div>
          </div>
          <span className="auto-text">
            {isPaused
              ? '⏸ Timer paused — click button to begin'
              : `Entering registration in ${secondsLeft}s... (Hover to pause)`}
          </span>
        </div>
      </div>
    </div>
  );
};
