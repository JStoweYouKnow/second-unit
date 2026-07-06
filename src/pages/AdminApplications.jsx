import { useState } from 'react'
import { CheckCircle, X, Clock, User, Mail, MapPin, ExternalLink } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import {
  useAdminApplications,
  approveApplication,
  rejectApplication,
  isPendingApplicant,
} from '../hooks/useArtistApplication'

function ApplicationCard({ app, onApprove, onReject, busy }) {
  const [reason, setReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <article className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 18 }}>{app.fullName}</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{app.roleTitle}</div>
        </div>
        <span className={`badge ${app.status === 'pending' ? '' : app.status === 'approved' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
          {app.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
          <Mail size={14} /> {app.email}
        </div>
        {app.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
            <MapPin size={14} /> {app.location}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
          <Clock size={14} /> {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}
        </div>
      </div>

      {app.bio && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 16 }}>{app.bio}</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {(app.skills || []).map((skill) => (
          <span key={skill} className="skill-tag">{skill}</span>
        ))}
      </div>

      {(app.brands || []).length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          <strong>Clients:</strong> {app.brands.join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13 }}>
        {app.website && <a href={app.website} target="_blank" rel="noopener noreferrer" className="btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ExternalLink size={14} /> Portfolio</a>}
        {app.instagram && <a href={app.instagram} target="_blank" rel="noopener noreferrer" className="btn-link">Instagram</a>}
        {app.linkedin && <a href={app.linkedin} target="_blank" rel="noopener noreferrer" className="btn-link">LinkedIn</a>}
      </div>

      {isPendingApplicant(app) && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          {showReject ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <textarea
                className="filter-select"
                style={{ width: '100%', minHeight: 80, padding: 12 }}
                placeholder="Optional feedback for the applicant…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReject(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="button" className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }} onClick={() => onReject(app.id, reason)} disabled={busy}>
                  Confirm reject
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onApprove(app.id)} disabled={busy}>
                <CheckCircle size={14} /> Approve
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReject(true)} disabled={busy}>
                <X size={14} /> Reject
              </button>
            </div>
          )}
        </div>
      )}

      {app.rejectionReason && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: 13 }}>
          <strong>Rejection reason:</strong> {app.rejectionReason}
        </div>
      )}
    </article>
  )
}

export default function AdminApplications() {
  const { isAdmin, fetchProfile } = useAuth()
  const { applications, loading, error, refetch } = useAdminApplications(isAdmin)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [filter, setFilter] = useState('pending')

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <User size={40} style={{ marginBottom: 16, opacity: 0.5 }} />
          <h2>Admin access required</h2>
          <p style={{ color: 'var(--text-muted)' }}>You don't have permission to review artist applications.</p>
        </div>
      </div>
    )
  }

  const filtered = applications.filter((app) => filter === 'all' || app.status === filter)
  const pendingCount = applications.filter((a) => a.status === 'pending').length

  const handleApprove = async (id) => {
    setBusyId(id)
    setActionError('')
    const { error: approveError } = await approveApplication(id)
    if (approveError) {
      setActionError(approveError.message)
    } else {
      await refetch()
      await fetchProfile?.()
    }
    setBusyId(null)
  }

  const handleReject = async (id, reason) => {
    setBusyId(id)
    setActionError('')
    const { error: rejectError } = await rejectApplication(id, reason)
    if (rejectError) {
      setActionError(rejectError.message)
    } else {
      await refetch()
    }
    setBusyId(null)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Artist Applications</h1>
            <p>Review and approve artists joining the marketplace</p>
          </div>
          {pendingCount > 0 && (
            <span className="badge" style={{ fontSize: 14, padding: '8px 14px' }}>
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['pending', 'approved', 'rejected', 'all'].map((status) => (
          <button
            key={status}
            type="button"
            className={`btn btn-sm ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {actionError && <div className="auth-error" style={{ marginBottom: 16 }}>{actionError}</div>}
      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading applications…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No {filter === 'all' ? '' : filter} applications found.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filtered.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              onApprove={handleApprove}
              onReject={handleReject}
              busy={busyId === app.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
