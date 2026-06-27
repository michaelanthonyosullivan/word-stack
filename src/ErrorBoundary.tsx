import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: '#11161f', color: '#f1f5f9', padding: '24px',
          fontFamily: 'sans-serif', textAlign: 'center'
        }}>
          <div style={{ maxWidth: '480px' }}>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
              Something went wrong
            </p>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '16px' }}>
              The app hit an error and couldn't continue. Refreshing usually fixes it — if it keeps
              happening, send a screenshot of the message below.
            </p>
            <pre style={{
              background: '#0a0e15', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px',
              padding: '12px', fontSize: '11px', color: '#fca5a5', textAlign: 'left', overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }}>
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px', background: '#dc2626', color: 'white', fontWeight: 700,
                padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px'
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
