import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './i18n/config'
import { CRApp } from './components/app'

class CRErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err?.message ?? String(err) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', padding: 24, gap: 12,
          background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 320 }}>
            {this.state.message || 'An unexpected error occurred.'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 20px', borderRadius: 10,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CRErrorBoundary>
      <CRApp />
    </CRErrorBoundary>
  </React.StrictMode>
)
