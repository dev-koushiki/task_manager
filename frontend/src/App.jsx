import { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { LoginScreen } from './components/LoginScreen';
import { AcceptInviteScreen } from './components/AcceptInviteScreen';
import { Dashboard } from './components/Dashboard';
import { ThemeToggle } from './components/ThemeToggle';
import { api } from './services/api';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState(() => {
    // Check if opened via an invitation link
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
      return 'accept-invite';
    }
    return 'welcome';
  });

  const [activeInviteToken, setActiveInviteToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || '';
  });

  const [currentUser, setCurrentUser] = useState(() => api.getUser());
  const [prefilledEmail, setPrefilledEmail] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Dark & Light theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tm_theme_v2');
    if (saved) return saved;
    localStorage.setItem('tm_theme_v2', 'light');
    localStorage.setItem('tm_theme', 'light');
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tm_theme', theme);
    localStorage.setItem('tm_theme_v2', theme);
  }, [theme]);

  // Purge any old placeholder dummy tasks from previous sessions
  useEffect(() => {
    const local = localStorage.getItem('tm_tasks');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (t) => !['task_1', 'task_2', 'task_3', 'task_4'].includes(t._id)
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('tm_tasks', JSON.stringify(cleaned));
          }
        }
      } catch {
        localStorage.removeItem('tm_tasks');
      }
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Handlers for navigation transitions
  const handleGetStarted = () => {
    setCurrentView('register');
  };

  const handleGoToLogin = () => {
    setSuccessNotice('');
    setCurrentView('login');
  };

  const handleGoToRegister = () => {
    setCurrentView('register');
  };

  const handleGoBackToWelcome = () => {
    setCurrentView('welcome');
  };

  const handleRegisterSuccess = (newUser, email, message) => {
    setPrefilledEmail(email);
    setSuccessNotice(
      message ||
        `Account successfully registered for ${newUser.firstName}! Please sign in below.`
    );
    // Flow: Register -> Login
    setCurrentView('login');
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    // Flow: Login -> Expected Dashboard
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setPrefilledEmail('');
    setSuccessNotice('');
    setCurrentView('welcome');
  };

  // Admin tests employee invitation directly
  const handleTestAcceptInvite = (token) => {
    setActiveInviteToken(token);
    setCurrentView('accept-invite');
  };

  const handleAccountActivated = (user) => {
    setCurrentUser(user);
    // Clean URL query parameter if present
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setCurrentView('dashboard');
  };

  return (
    <div className={`app-root ${theme === 'light' ? 'light-mode' : 'dark-mode'}`}>
      {/* Floating theme toggle for Welcome, Register, Login, and Accept Invite views */}
      {currentView !== 'dashboard' && (
        <div className="floating-theme-bar">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      )}

      {currentView === 'welcome' && (
        <WelcomeScreen
          onGetStarted={handleGetStarted}
          onGoToLogin={handleGoToLogin}
        />
      )}

      {currentView === 'register' && (
        <RegisterScreen
          onGoToLogin={handleGoToLogin}
          onGoBackToWelcome={handleGoBackToWelcome}
          onRegisterSuccess={handleRegisterSuccess}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {currentView === 'login' && (
        <LoginScreen
          initialEmail={prefilledEmail}
          successNotice={successNotice}
          onGoToRegister={handleGoToRegister}
          onGoBackToWelcome={handleGoBackToWelcome}
          onLoginSuccess={handleLoginSuccess}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {currentView === 'accept-invite' && (
        <AcceptInviteScreen
          inviteToken={activeInviteToken}
          onAccountActivated={handleAccountActivated}
          onGoToLogin={handleGoToLogin}
        />
      )}

      {currentView === 'dashboard' && (
        <Dashboard
          user={currentUser}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
          onTestAcceptInvite={handleTestAcceptInvite}
        />
      )}
    </div>
  );
}

export default App;
