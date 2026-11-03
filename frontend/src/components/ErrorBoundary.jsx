import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Taskflow ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="error-boundary-fallback animate-fade-in"
          style={{
            padding: '40px 24px',
            margin: '32px auto',
            maxWidth: '540px',
            textAlign: 'center',
            background: 'var(--bg-card, #111827)',
            border: '1px solid var(--border-color, #1f2937)',
            borderRadius: '16px',
            color: 'var(--text-main, #f8fafc)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            ⚠️
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 600 }}>
            {this.props.fallbackTitle || 'Unable to display this view'}
          </h3>
          <p
            style={{
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '13px',
              margin: '0 0 20px 0',
              lineHeight: '1.5',
            }}
          >
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={this.handleReset}
          >
            Reload View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
