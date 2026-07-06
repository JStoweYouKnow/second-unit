import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, LogIn, ArrowRight } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { PENDING_APPLY_KEY } from '../hooks/useArtistApplication'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import BrandLogo from '../components/BrandLogo'
import ThemeToggle from '../components/ThemeToggle'
import OAuthButtons from '../components/OAuthButtons'

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
  const [view, setView] = useState('sign-in') // sign-in | forgot-password | forgot-password-success | mfa
  const [mfaFactorId, setMfaFactorId] = useState(null)
  const [mfaCode, setMfaCode] = useState('')

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

  const finishSignIn = () => {
    const hasPendingApplication = sessionStorage.getItem(PENDING_APPLY_KEY)
    navigate(hasPendingApplication ? '/application-status' : '/home')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await signIn({ email, password })
      if (error) {
        setError(error.message)
        return
      }

      if (isSupabaseConfigured && supabase) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
          const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors()
          if (factorError) throw factorError
          const verified = factors?.totp?.find((f) => f.status === 'verified')
          if (verified) {
            setMfaFactorId(verified.id)
            setView('mfa')
            return
          }
        }
      }

      finishSignIn()
    } catch (err) {
      setError(err.message || 'Sign in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMfaVerify = async (e) => {
    e.preventDefault()
    if (!supabase || !mfaFactorId) return
    setError('')
    setLoading(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      })
      if (verifyError) throw verifyError
      finishSignIn()
    } catch (err) {
      setError(err.message || 'Invalid authenticator code')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message)
      } else {
        setView('forgot-password-success')
      }
    } catch (err) {
      setError(err.message || 'Could not send reset link. Try again.')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="auth-page">
      <ThemeToggle variant="compact" className="auth-theme-toggle" />
      <div className="auth-container slide-up">
        <div className="auth-header">
          <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 16 }}>
            <BrandLogo variant="auth" />
          </div>
          <h1>{view === 'mfa' ? 'Two-factor authentication' : view === 'sign-in' ? 'Welcome back' : view === 'forgot-password-success' ? 'Check your email' : 'Reset your password'}</h1>
          <p>{view === 'mfa' ? 'Enter the 6-digit code from your authenticator app' : view === 'sign-in' ? 'Sign in to your account to continue' : view === 'forgot-password-success' ? 'A password reset link has been sent.' : 'Enter your email to receive a reset link'}</p>
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
        ) : view === 'mfa' ? (
          <form onSubmit={handleMfaVerify}>
            <div className="form-group">
              <label className="form-label">Authenticator code</label>
              <input
                className="form-input"
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </div>
            <button className="btn btn-primary btn-lg auth-submit" type="submit" disabled={loading || mfaCode.length < 6}>
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ marginTop: 12, width: '100%' }} onClick={() => { setView('sign-in'); setMfaCode('') }}>
              Back
            </button>
          </form>
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

        {view === 'sign-in' && <OAuthButtons disabled={loading} />}

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
