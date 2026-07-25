import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Mail, User, ArrowLeft, UserPlus, Palette, Briefcase } from '../components/icons'
import PasswordInput from '../components/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../lib/api'
import BrandLogo from '../components/BrandLogo'
import ThemeToggle from '../components/ThemeToggle'
import OAuthButtons from '../components/OAuthButtons'

export default function SignUp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp, signIn, signInWithOAuth, isMockMode } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(searchParams.get('role') === 'artist' ? 'artist' : 'employer')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('role') === 'artist') {
      navigate('/apply', { replace: true })
    }
  }, [searchParams, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isMockMode) {
        const { error: mockErr } = await signUp({ email, password, fullName, role: 'employer' })
        if (mockErr) {
          setError(mockErr.message)
          return
        }
        navigate('/home')
        return
      }

      // Server path: confirmed account without Supabase confirmation-email SMTP.
      await authApi.signupHirer({ email, password, fullName })
      const { error: signInError } = await signIn({ email, password })
      if (signInError) {
        setError(
          signInError.message ||
            'Account created, but sign-in failed. Try signing in with your email and password.'
        )
        return
      }
      navigate('/home')
    } catch (err) {
      setError(err.message || 'Could not create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <ThemeToggle variant="compact" className="auth-theme-toggle" />
      <div className="auth-container slide-up">
        <div className="auth-header">
          <div className="logo">
            <BrandLogo variant="auth" />
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
          <button type="button" className={`auth-role-option ${role === 'artist' ? 'active' : ''}`} onClick={() => navigate('/apply')}>
            <Palette size={20} />
            <span>I'm an artist</span>
            <small>Apply to join the marketplace</small>
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
            <PasswordInput
              name="password"
              autoComplete="new-password"
              placeholder="Min 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={isMockMode ? 0 : 8}
              required={!isMockMode}
            />
          </div>
          <button
            className="btn btn-primary btn-lg auth-submit"
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Creating account...' : <><UserPlus size={18} aria-hidden /> Create Account</>}
          </button>
        </form>

        <OAuthButtons disabled={loading} />

        <p className="auth-footer" style={{ marginTop: '24px' }}>
          Already have an account? <Link to="/signin"><ArrowLeft size={14} /> Sign In</Link>
        </p>
      </div>
    </div>
  )
}
