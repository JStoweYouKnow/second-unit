import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, LogIn } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'

export default function UpdatePassword() {
  const navigate = useNavigate()
  const { updatePassword, isMockMode } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => {
        navigate('/home')
      }, 2000)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container slide-up">
        <div className="auth-header">
          <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 16 }}>
            <BrandLogo />
          </div>
          <h1>Update Password</h1>
          <p>Enter your new password below</p>
        </div>

        {isMockMode && (
          <div className="auth-mock-banner">
            Demo Mode — Password updates are simulated.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-error" style={{ background: 'var(--success-muted-bg)', color: 'var(--success)', borderColor: 'var(--success)' }}>Password updated successfully! Redirecting...</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} />
              <input
                className="form-input"
                type="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
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
