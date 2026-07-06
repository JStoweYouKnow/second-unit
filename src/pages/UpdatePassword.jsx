import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, LogIn, Clock } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'
import { establishRecoverySession } from '../lib/authRecovery'

export default function UpdatePassword() {
  const navigate = useNavigate()
  const { updatePassword, isMockMode } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(isMockMode)
  const [checkingSession, setCheckingSession] = useState(!isMockMode)

  useEffect(() => {
    if (isMockMode) return

    let cancelled = false

    establishRecoverySession().then(({ ready, error: sessionError }) => {
      if (cancelled) return
      setSessionReady(ready)
      if (!ready && sessionError) setError(sessionError)
      setCheckingSession(false)
    })

    return () => { cancelled = true }
  }, [isMockMode])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!sessionReady && !isMockMode) {
      setError('Your reset session expired. Request a new link from the sign-in page.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const { error: updateError } = await updatePassword(password)
    setLoading(false)

    if (updateError) {
      setError(updateError.message || 'Failed to update password. Try requesting a new reset link.')
    } else {
      setSuccess(true)
      setTimeout(() => {
        navigate('/signin', { replace: true })
      }, 2000)
    }
  }

  if (checkingSession) {
    return (
      <div className="auth-page">
        <div className="auth-container slide-up" style={{ textAlign: 'center' }}>
          <Clock size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Verifying your reset link…</p>
        </div>
      </div>
    )
  }

  if (!sessionReady && !isMockMode) {
    return (
      <div className="auth-page">
        <div className="auth-container slide-up" style={{ textAlign: 'center' }}>
          <BrandLogo variant="auth" />
          <h1 style={{ marginTop: 24 }}>Reset link invalid</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            {error || 'This password reset link is invalid or has expired.'}
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
            <BrandLogo variant="auth" />
          </div>
          <h1>Update Password</h1>
          <p>Enter your new password below</p>
        </div>

        {isMockMode && (
          <div className="auth-mock-banner">
            Demo Mode — Password updates are simulated.
          </div>
        )}

        {error && sessionReady && <div className="auth-error">{error}</div>}
        {success && (
          <div
            className="auth-error"
            style={{ background: 'var(--success-muted-bg)', color: 'var(--success)', borderColor: 'var(--success)' }}
          >
            Password updated successfully! Redirecting to sign in…
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Password</label>
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
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} />
              <input
                className="form-input"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Min 8 characters"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg auth-submit"
            type="submit"
            disabled={loading || success}
            aria-busy={loading}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
