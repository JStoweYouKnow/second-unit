import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)',
          textAlign: 'center', padding: 20
        }}>
          <AlertTriangle size={64} style={{ color: 'var(--danger)', marginBottom: 24 }} />
          <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Oops! Something went wrong</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 400 }}>
            An unexpected error occurred. Don't worry, we've been notified and are looking into it.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <RefreshCw size={18} /> Refresh Page
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre style={{
              marginTop: 40, padding: 16, background: 'var(--surface)', borderRadius: 8,
              fontSize: 12, textAlign: 'left', overflow: 'auto', maxWidth: '80vw'
            }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
