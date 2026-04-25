import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User, ArrowLeft, UserPlus, Palette, Briefcase } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'

export default function SignUp() {
  const navigate = useNavigate()
  const { signUp, signInWithOAuth, isMockMode } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('employer')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signUp({ email, password, fullName, role })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else if (isMockMode) {
      navigate('/')
    } else {
      setSuccess(true)
    }
  }

  const handleOAuth = async (provider) => {
    setError('')
    setOauthLoading(provider)
    const { error: oauthError } = await signInWithOAuth(provider)
    setOauthLoading(null)
    if (oauthError) setError(oauthError.message)
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container slide-up" style={{ textAlign: 'center' }}>
          <Mail size={48} style={{ marginBottom: 16, color: 'var(--accent)', opacity: 0.8 }} />
          <h1>Check your email</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click the link to activate your account.
          </p>
          <Link to="/signin" className="btn btn-primary">Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-container slide-up">
        <div className="auth-header">
          <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 16 }}>
            <BrandLogo />
          </div>
          <h1>Create your account</h1>
          <p>Join the premier AI artist marketplace</p>
        </div>

        {isMockMode && (
          <div className="auth-mock-banner">
            Demo Mode — Supabase not configured. Click sign up to enter as a demo user.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-role-picker">
          <button type="button" className={`auth-role-option ${role === 'employer' ? 'active' : ''}`} onClick={() => setRole('employer')}>
            <Briefcase size={20} />
            <span>I'm hiring</span>
            <small>Find and book AI artists</small>
          </button>
          <button type="button" className={`auth-role-option ${role === 'artist' ? 'active' : ''}`} onClick={() => setRole('artist')}>
            <Palette size={20} />
            <span>I'm an artist</span>
            <small>Showcase work & get hired</small>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="auth-input-wrapper">
              <User size={16} />
              <input
                className="form-input"
                name="name"
                autoComplete="name"
                placeholder="Your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          </div>
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
                autoComplete="new-password"
                placeholder="Min 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={isMockMode ? 0 : 8}
                required={!isMockMode}
              />
            </div>
          </div>
          <button
            className="btn btn-primary btn-lg auth-submit"
            type="submit"
            disabled={loading || !!oauthLoading}
            aria-busy={loading}
          >
            {loading ? 'Creating account...' : <><UserPlus size={18} aria-hidden /> Create Account</>}
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
          Already have an account? <Link to="/signin"><ArrowLeft size={14} /> Sign In</Link>
        </p>
      </div>
    </div>
  )
}
