import { Link, Navigate } from 'react-router-dom'
import { Clock, AlertCircle, ArrowRight, Palette } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'
import {
  useMyApplication,
  isPendingApplicant,
  isRejectedApplicant,
  isApprovedApplicant,
} from '../hooks/useArtistApplication'
import { useArtistProfile } from '../hooks/useArtistProfile'
import { getStoredInviteToken } from '../hooks/useArtistInvites'

export default function ApplicationStatus() {
  const { isAuthenticated, profile, user, loading: authLoading } = useAuth()
  const { application, loading } = useMyApplication(profile?.id || user?.id)
  const { artist } = useArtistProfile(profile?.id || user?.id)

  if (authLoading || loading) {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <Clock size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading application status…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />
  }

  if (artist || isApprovedApplicant(application)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!application) {
    const storedInvite = getStoredInviteToken()
    const applyPath = storedInvite ? `/apply?invite=${encodeURIComponent(storedInvite)}` : '/apply'
    return <Navigate to={applyPath} replace />
  }

  const pending = isPendingApplicant(application)
  const rejected = isRejectedApplicant(application)

  return (
    <div className="auth-page">
      <div className="auth-container slide-up" style={{ textAlign: 'center' }}>
        <div className="logo" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0, marginBottom: 24 }}>
          <BrandLogo variant="auth" />
        </div>

        {pending && (
          <>
            <Clock size={56} style={{ marginBottom: 20, color: 'var(--gold)', opacity: 0.9 }} />
            <h1>Application under review</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Thanks, {application.fullName}. We're reviewing your portfolio and will get back to you soon.
              You'll receive full marketplace access once approved.
            </p>
          </>
        )}

        {rejected && (
          <>
            <AlertCircle size={56} style={{ marginBottom: 20, color: 'var(--warning)' }} />
            <h1>Application not approved</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              Unfortunately we weren't able to approve your application at this time.
            </p>
            {application.rejectionReason && (
              <div style={{ textAlign: 'left', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Feedback</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{application.rejectionReason}</p>
              </div>
            )}
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
              To apply again, you'll need a new private invite link from our team.
            </p>
          </>
        )}

        <div style={{ textAlign: 'left', padding: 20, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Submitted details</div>
          <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
            <div><strong>Title:</strong> {application.roleTitle}</div>
            <div><strong>Location:</strong> {application.location || '—'}</div>
            <div><strong>Skills:</strong> {application.skills?.join(', ') || '—'}</div>
            <div><strong>Submitted:</strong> {application.createdAt ? new Date(application.createdAt).toLocaleDateString() : '—'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {rejected && (
            <Link to="/apply" className="btn btn-primary">
              <Palette size={16} /> Apply with new invite
            </Link>
          )}
          {pending && (
            <Link to="/account" className="btn btn-secondary">
              Account settings
            </Link>
          )}
          <Link to="/" className="btn btn-secondary">
            Back to home
          </Link>
        </div>

        {pending && (
          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
            Questions? Email <a href="mailto:support@thecallsheet.ai" style={{ color: 'var(--gold)' }}>support@thecallsheet.ai</a>
          </p>
        )}
      </div>
    </div>
  )
}

export function ApplicationStatusBanner() {
  const { profile, user } = useAuth()
  const { application } = useMyApplication(profile?.id || user?.id)

  if (!application || !isPendingApplicant(application)) return null

  return (
    <div style={{ padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 197, 66, 0.3)', background: 'rgba(245, 197, 66, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <Clock size={18} style={{ color: 'var(--gold)' }} />
        <span>Your artist application is pending review.</span>
      </div>
      <Link to="/application-status" className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        View status <ArrowRight size={14} />
      </Link>
    </div>
  )
}
