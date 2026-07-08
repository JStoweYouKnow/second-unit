import { useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Palette, Mail, Clock, Star } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'
import { ArtistFormFields } from '../components/ArtistFormFields'
import {
  emptyArtistForm,
  applicationToForm,
} from '../lib/artistProfile'
import {
  submitArtistApplication,
  flushPendingArtistApplication,
  useMyApplication,
  isPendingApplicant,
  isApprovedApplicant,
  PENDING_APPLY_KEY,
} from '../hooks/useArtistApplication'
import { useArtistProfile } from '../hooks/useArtistProfile'
import {
  useArtistInvite,
  persistInviteToken,
  getStoredInviteToken,
  clearStoredInviteToken,
  needsInviteForApplication,
  readInviteTokenFromUrl,
  INVITE_SESSION_KEY,
} from '../hooks/useArtistInvites'

const PROFILE_CHECK_TIMEOUT_MS = 12000

function ApplyLoadingScreen({ message }) {
  return (
    <div className="auth-page">
      <div className="auth-container" style={{ textAlign: 'center' }}>
        <Clock size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
      </div>
    </div>
  )
}

export default function ArtistApply() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile, signUp, isMockMode, isAuthenticated, fetchProfile, loading: authLoading } = useAuth()
  const { application, loading: appLoading, refetch } = useMyApplication(profile?.id || user?.id)
  const { artist, loading: artistLoading } = useArtistProfile(profile?.id || user?.id)

  const urlToken = useMemo(() => readInviteTokenFromUrl(searchParams), [searchParams])
  const mustHaveInvite = needsInviteForApplication(application, artist)
  const inviteToken = urlToken || (mustHaveInvite ? getStoredInviteToken() : null)
  const { invite, loading: inviteLoading, error: inviteError } = useArtistInvite(inviteToken)

  const [form, setForm] = useState(emptyArtistForm())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [profileCheckTimedOut, setProfileCheckTimedOut] = useState(false)

  const loggedIn = isAuthenticated

  useLayoutEffect(() => {
    if (urlToken) persistInviteToken(urlToken)
  }, [urlToken])

  useEffect(() => {
    if (!inviteLoading && invite && !invite.valid && inviteToken) {
      if (!urlToken) clearStoredInviteToken()
    }
  }, [inviteLoading, invite, inviteToken, urlToken])

  useEffect(() => {
    if (!loggedIn || (!appLoading && !artistLoading)) {
      setProfileCheckTimedOut(false)
      return
    }
    const timer = setTimeout(() => setProfileCheckTimedOut(true), PROFILE_CHECK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [loggedIn, appLoading, artistLoading])

  useEffect(() => {
    if (invite?.valid && invite.email && !form.email) {
      setForm((prev) => ({ ...prev, email: invite.email }))
    }
    if (invite?.valid && invite.artistName && !form.fullName) {
      setForm((prev) => ({ ...prev, fullName: invite.artistName }))
    }
  }, [invite?.valid, invite?.email, invite?.artistName])

  useEffect(() => {
    if (loggedIn && profile && !appLoading && !artistLoading) {
      if (artist || isApprovedApplicant(application)) {
        navigate('/dashboard', { replace: true })
        return
      }
      if (isPendingApplicant(application)) {
        navigate('/application-status', { replace: true })
        return
      }
      if (application) {
        setForm(applicationToForm(application))
        if (user?.email) {
          setForm((prev) => ({ ...prev, email: user.email }))
        }
      } else if (profile?.full_name) {
        setForm((prev) => ({
          ...prev,
          fullName: profile.full_name,
          email: user?.email || prev.email,
        }))
      }
    }
  }, [loggedIn, profile, application, artist, appLoading, artistLoading, navigate, user?.email])

  useEffect(() => {
    async function runPendingFlush() {
      if (!loggedIn || !profile?.id || appLoading || application) return

      setLoading(true)
      try {
        const { flushed, error: flushError } = await flushPendingArtistApplication({
          profileId: profile.id,
          email: user?.email,
        })
        if (flushError) {
          setError(flushError.message || 'Failed to submit your saved application')
        } else if (flushed) {
          await refetch()
          navigate('/application-status', { replace: true })
        }
      } finally {
        setLoading(false)
      }
    }

    runPendingFlush()
  }, [loggedIn, profile?.id, appLoading, application, user?.email, refetch, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const activeToken = getStoredInviteToken()

    try {
      let profileId = profile?.id || user?.id
      let email = form.email.trim()

      if (!loggedIn) {
        const { error: signUpError } = await signUp({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: 'employer',
        })

        if (signUpError) {
          setError(signUpError.message)
          setLoading(false)
          return
        }

        if (isMockMode) {
          profileId = 'mock-user-001'
          email = form.email.trim()
          await fetchProfile?.('mock-user-001')
        } else {
          sessionStorage.setItem(PENDING_APPLY_KEY, JSON.stringify(form))
          if (activeToken) sessionStorage.setItem(INVITE_SESSION_KEY, activeToken)
          setSubmitted(true)
          setLoading(false)
          return
        }
      }

      const { error: submitError } = await submitArtistApplication({
        form,
        profileId,
        email: email || user?.email,
        existingApplication: application,
        inviteToken: activeToken,
      })

      if (submitError) {
        setError(submitError.message || 'Failed to submit application')
        setLoading(false)
        return
      }

      clearStoredInviteToken()
      await refetch()
      if (isMockMode) {
        navigate('/application-status')
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-container slide-up" style={{ textAlign: 'center' }}>
          <Mail size={48} style={{ marginBottom: 16, color: 'var(--accent)', opacity: 0.8 }} />
          <h1>Application received</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            {loggedIn ? (
              <>Your artist application is under review. We'll notify you once a decision is made.</>
            ) : (
              <>
                We sent a confirmation link to <strong>{form.email}</strong>.<br />
                After you confirm your email and sign in, your application will be submitted automatically for review.
              </>
            )}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signin" className="btn btn-primary">Sign In</Link>
            <Link to="/" className="btn btn-secondary">Back to Home</Link>
          </div>
        </div>
      </div>
    )
  }

  if (authLoading) {
    return <ApplyLoadingScreen message="Checking session…" />
  }

  if (inviteToken && inviteLoading) {
    return <ApplyLoadingScreen message="Verifying your invite…" />
  }

  const waitingOnProfile = loggedIn && (appLoading || artistLoading) && !profileCheckTimedOut
  if (waitingOnProfile) {
    return <ApplyLoadingScreen message="Loading your profile…" />
  }

  if (mustHaveInvite && !inviteLoading && !invite?.valid) {
    const reasonMessages = {
      missing: 'Artist applications are invite-only during our private beta.',
      invalid: 'This invite link is not valid. Double-check the URL or contact us for a new link.',
      used: 'This invite has already been used. Contact us if you need a new one.',
      expired: 'This invite link has expired. Contact us for a fresh invitation.',
    }
    const hadToken = Boolean(inviteToken?.trim())
    const message = !hadToken
      ? reasonMessages.missing
      : (reasonMessages[invite?.reason] || reasonMessages.invalid)

    return (
      <div className="auth-page">
        <div className="auth-container slide-up" style={{ textAlign: 'center' }}>
          <BrandLogo variant="auth" />
          <div style={{ margin: '24px 0 16px' }}>
            <Star size={48} style={{ color: 'var(--gold)', opacity: 0.85 }} />
          </div>
          <h1>Invite only</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
          {inviteError && (
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>{inviteError}</p>
          )}
          {hadToken && invite?.reason === 'invalid' && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Ask your admin to create a fresh invite from the production admin panel, then open the full link (including everything after <code>?invite=</code>).
            </p>
          )}
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
            The Callsheet is a curated marketplace. We send private invite links directly to selected artists.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-secondary">Back to Home</Link>
            <a href="mailto:support@thecallsheet.ai" className="btn btn-primary">Request access</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-container auth-container--wide slide-up">
        <div className="auth-header">
          <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 16 }}>
            <BrandLogo variant="auth" />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(245, 197, 66, 0.1)', border: '1px solid rgba(245, 197, 66, 0.2)', borderRadius: 30, color: 'var(--gold)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            <Palette size={14} /> Private Invite
          </div>
          <h1>Apply to join The Callsheet</h1>
          <p>
            {invite?.artistName
              ? `Welcome${invite.artistName ? `, ${invite.artistName.split(' ')[0]}` : ''}. Complete your application below.`
              : 'Share your portfolio and experience. Our team reviews every application manually.'}
          </p>
        </div>

        {isMockMode && (
          <div className="auth-mock-banner">
            Demo Mode — applications are saved locally in your browser.
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <ArtistFormFields
            form={form}
            onChange={setForm}
            showAccountFields={!loggedIn}
            disabledAccountFields={false}
            lockEmail={Boolean(invite?.email)}
          />

          <div style={{ margin: '24px 0', padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>How you get paid</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-tint-10)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>1</div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Client pays upfront</div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>The full agreed fee is charged to the client when they book you. Funds are held securely.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-tint-10)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>2</div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>You deliver the project</div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>Complete the work you and the client agreed to. The client marks the project complete when they're satisfied.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--success-muted-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>3</div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>You get paid via Stripe</div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>When the client pays to start the project, your payout is sent to your connected Stripe account.</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Example: on a $1,000 booking, you receive your agreed payout via Stripe Connect once the client pays to start the project.
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            By submitting, you agree that the information provided is accurate and that you accept The Callsheet's artist terms. Approved artists receive a profile on our invite-only marketplace.
          </p>

          <button
            className="btn btn-primary btn-lg auth-submit"
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Submitting…' : application?.status === 'rejected' ? 'Resubmit Application' : 'Submit Application'}
          </button>
        </form>

        <p className="auth-footer" style={{ marginTop: 24 }}>
          {loggedIn ? (
            <Link to="/application-status"><ArrowLeft size={14} /> View application status</Link>
          ) : (
            <>Already have an account? <Link to="/signin">Sign In</Link></>
          )}
        </p>
      </div>
    </div>
  )
}
