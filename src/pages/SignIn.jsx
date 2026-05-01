import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, LogIn, ArrowRight } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'

function readOAuthErrorFromUrl() {
  const q = new URLSearchParams(window.location.search)
  const fromQuery = q.get('error_description') || q.get('error')
  if (fromQuery) return decodeURIComponent(fromQuery.replace(/\+/g, ' '))
  const hash = window.location.hash?.replace(/^#/, '') ?? ''
  if (!hash) return ''
  const h = new URLSearchParams(hash)
  const fromHash = h.get('error_description') || h.get('error')
  if (fromHash) return decodeURIComponent(fromHash.replace(/\+/g, ' '))
  return ''
}

export default function SignIn() {
  const navigate = useNavigate()
  const { signIn, signInWithOAuth, resetPassword, isMockMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('sign-in') // 'sign-in', 'forgot-password', 'forgot-password-success'

  useEffect(() => {
    const msg = readOAuthErrorFromUrl()
    if (msg) {
      setError(msg)
      const url = new URL(window.location.href)
      url.search = ''
      url.hash = ''
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      navigate('/home')
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setView('forgot-password-success')
    }
  }


  return (
    <div className="auth-page">
      <div className="auth-container slide-up">
        <div className="auth-header">
          <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 16 }}>
            <BrandLogo />
          </div>
          <h1>{view === 'sign-in' ? 'Welcome back' : view === 'forgot-password-success' ? 'Check your email' : 'Reset your password'}</h1>
          <p>{view === 'sign-in' ? 'Sign in to your account to continue' : view === 'forgot-password-success' ? 'A password reset link has been sent.' : 'Enter your email to receive a reset link'}</p>
        </div>

        {isMockMode && (
          <div className="auth-mock-banner">
            Demo Mode — Supabase not configured. Click sign in to enter as a demo user.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        {view === 'forgot-password-success' ? (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button className="btn btn-primary" onClick={() => setView('sign-in')}>Return to Sign In</button>
          </div>
        ) : (
          <form onSubmit={view === 'sign-in' ? handleSubmit : handleForgotPassword}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="auth-input-wrapper">
                <Mail size={16} />
                <input
                  className="form-input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            
            {view === 'sign-in' && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                  <button type="button" className="btn-link" onClick={() => setView('forgot-password')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, cursor: 'pointer', padding: 0 }}>Forgot?</button>
                </div>
                <div className="auth-input-wrapper">
                  <Lock size={16} />
                  <input
                    className="form-input"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required={!isMockMode}
                  />
                </div>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg auth-submit"
              type="submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (view === 'sign-in' ? 'Signing in...' : 'Sending link...') : (view === 'sign-in' ? <><LogIn size={18} aria-hidden /> Sign In</> : 'Send Reset Link')}
            </button>
          </form>
        )}

        <p className="auth-footer" style={{ marginTop: '24px' }}>
          {view === 'sign-in' ? (
            <>Don't have an account? <Link to="/signup">Sign Up <ArrowRight size={14} /></Link></>
          ) : (
            <button type="button" className="btn-link" onClick={() => setView('sign-in')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', padding: 0 }}>Back to Sign In</button>
          )}
        </p>
      </div>
    </div>
  )
}
