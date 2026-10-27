import { SunIcon, MoonIcon } from './Icons';

export const ThemeToggle = ({ theme, onToggle, className = "" }) => {
  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? (
        <span className="theme-toggle-inner">
          <SunIcon size={18} className="theme-icon sun" />
          <span className="theme-label">Light</span>
        </span>
      ) : (
        <span className="theme-toggle-inner">
          <MoonIcon size={18} className="theme-icon moon" />
          <span className="theme-label">Dark</span>
        </span>
      )}
    </button>
  );
};
