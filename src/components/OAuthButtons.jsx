import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
  { id: 'linkedin_oidc', label: 'LinkedIn' },
]

export default function OAuthButtons({ disabled = false }) {
  const { signInWithOAuth, isMockMode } = useAuth()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')

  if (isMockMode) return null

  async function handleOAuth(provider) {
    setError('')
    setLoading(provider)
    try {
      const { error: oauthError } = await signInWithOAuth(provider)
      if (oauthError) setError(oauthError.message)
    } catch (err) {
      setError(err.message || 'OAuth sign-in failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="oauth-buttons">
      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="oauth-divider">
        <span>or continue with</span>
      </div>
      <div className="oauth-button-row">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn btn-secondary oauth-btn"
            disabled={disabled || loading != null}
            aria-busy={loading === p.id}
            onClick={() => handleOAuth(p.id)}
          >
            {loading === p.id ? 'Redirecting…' : p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
