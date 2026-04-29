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
  const { signIn, signInWithOAuth, isMockMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)

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
      navigate('/')
    }
  }

  const handleOAuth = async (provider) => {
    setError('')
    setOauthLoading(provider)
    const { error: oauthError } = await signInWithOAuth(provider)
    setOauthLoading(null)
    if (oauthError) {
      if (oauthError.message?.includes('Unsupported provider')) {
        setError(`${provider} login is not enabled. Please enable it in your Supabase Dashboard under Authentication > Providers.`)
      } else {
        setError(oauthError.message)
      }
    } else if (isMockMode) {
      navigate('/')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container slide-up">
        <div className="auth-header">
          <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 16 }}>
            <BrandLogo />
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to your account to continue</p>
        </div>

        {isMockMode && (
          <div className="auth-mock-banner">
            Demo Mode — Supabase not configured. Click sign in to enter as a demo user.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
          <div className="form-group">
            <label className="form-label">Password</label>
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
          <button
            className="btn btn-primary btn-lg auth-submit"
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Signing in...' : <><LogIn size={18} aria-hidden /> Sign In</>}
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <div className="auth-oauth-row">
          <button type="button" className="btn btn-secondary auth-oauth-btn" disabled={!!oauthLoading}
            onClick={() => handleOAuth('google')}>
            {oauthLoading === 'google' ? 'Redirecting…' : 'Google'}
          </button>
          <button type="button" className="btn btn-secondary auth-oauth-btn" disabled={!!oauthLoading}
            onClick={() => handleOAuth('github')}>
            {oauthLoading === 'github' ? 'Redirecting…' : 'GitHub'}
          </button>
          <button type="button" className="btn btn-secondary auth-oauth-btn" disabled={!!oauthLoading}
            onClick={() => handleOAuth('linkedin_oidc')}>
            {oauthLoading === 'linkedin_oidc' ? 'Redirecting…' : 'LinkedIn'}
          </button>
        </div>

        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Sign Up <ArrowRight size={14} /></Link>
        </p>
      </div>
    </div>
  )
}
