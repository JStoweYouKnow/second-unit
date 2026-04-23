import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function SignIn() {
  const navigate = useNavigate()
  const { signIn, signInWithOAuth, isMockMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="auth-page">
      <div className="auth-container slide-up">
        <div className="auth-header">
          <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 8 }}>
            <div className="logo-icon">S</div>
            <span className="logo-text">Second Unit</span>
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to your account to continue</p>
        </div>

        {isMockMode && (
          <div className="auth-mock-banner">
            🧪 Demo Mode — Supabase not configured. Click sign in to enter as a demo user.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="auth-input-wrapper">
              <Mail size={16} />
              <input className="form-input" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} />
              <input className="form-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required={!isMockMode} />
            </div>
          </div>
          <button className="btn btn-primary btn-lg auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <div className="auth-oauth-row">
          <button className="btn btn-secondary auth-oauth-btn" onClick={() => signInWithOAuth('google')}>
            Google
          </button>
          <button className="btn btn-secondary auth-oauth-btn" onClick={() => signInWithOAuth('github')}>
            GitHub
          </button>
          <button className="btn btn-secondary auth-oauth-btn" onClick={() => signInWithOAuth('linkedin_oidc')}>
            LinkedIn
          </button>
        </div>

        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Sign Up <ArrowRight size={14} /></Link>
        </p>
      </div>
    </div>
  )
}
