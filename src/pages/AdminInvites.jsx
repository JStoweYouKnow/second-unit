import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Mail, Clock, CheckCircle, User, Trash2 } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import {
  useAdminInvites,
  createArtistInvite,
  deleteArtistInvite,
  validateArtistInvite,
  buildInviteUrl,
  inviteStatus,
} from '../hooks/useArtistInvites'
import { getInviteBaseUrl } from '../lib/siteUrl'

function InviteRow({ invite, onCopied, onDelete }) {
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const status = inviteStatus(invite)
  const url = buildInviteUrl(invite.token)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      onCopied?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const handleDelete = async () => {
    const label = invite.artistName || invite.email || 'this invite'
    if (!window.confirm(`Delete invite for ${label}? This cannot be undone.`)) return

    setDeleting(true)
    try {
      const { error } = await deleteArtistInvite(invite.id)
      if (error) {
        window.alert(error.message || 'Failed to delete invite')
        return
      }
      onDelete?.()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>
            {invite.artistName || 'Unnamed artist'}
          </h3>
          {invite.email && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> {invite.email}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${status === 'active' ? 'badge-success' : status === 'used' ? '' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
            {status}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete invite"
            aria-label={`Delete invite for ${invite.artistName || invite.email || 'artist'}`}
          >
            <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {invite.note && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>{invite.note}</p>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} /> Created {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : '—'}
        </span>
        {invite.expiresAt && status === 'active' && (
          <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
        )}
        {invite.usedAt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} /> Used {new Date(invite.usedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {status === 'active' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <code style={{ fontSize: 11, padding: '6px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', flex: 1, minWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {url}
          </code>
          <button type="button" className="btn btn-primary btn-sm" onClick={copyLink}>
            <Copy size={14} /> {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </article>
  )
}

export default function AdminInvites() {
  const { isAdmin, isMockMode } = useAuth()
  const { invites, loading, error, refetch } = useAdminInvites(isAdmin)

  const [artistName, setArtistName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [expiresDays, setExpiresDays] = useState(30)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [lastCreatedUrl, setLastCreatedUrl] = useState('')
  const [filter, setFilter] = useState('active')

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <User size={40} style={{ marginBottom: 16, opacity: 0.5 }} />
          <h2>Admin access required</h2>
          <p style={{ color: 'var(--text-muted)' }}>You don't have permission to manage artist invites.</p>
        </div>
      </div>
    )
  }

  const filtered = invites.filter((inv) => filter === 'all' || inviteStatus(inv) === filter)
  const activeCount = invites.filter((inv) => inviteStatus(inv) === 'active').length

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    setLastCreatedUrl('')

    try {
      const { data, error: createErr } = await createArtistInvite({
        artistName,
        email,
        note,
        expiresDays,
      })

      if (createErr) {
        setCreateError(createErr.message || 'Failed to create invite')
        return
      }

      if (!data?.token) {
        setCreateError('Something went wrong — refresh the page and check the invite list.')
        refetch({ silent: true })
        return
      }

      const validation = await validateArtistInvite(data.token)
      if (!validation.valid) {
        setCreateError(
          'Invite was created but could not be verified. Run supabase/fix-invite-validate.sql in Supabase, then create a new invite.'
        )
        refetch({ silent: true })
        return
      }

      const url = buildInviteUrl(data.token)
      setLastCreatedUrl(url)
      setArtistName('')
      setEmail('')
      setNote('')
      refetch({ silent: true })

      try {
        await navigator.clipboard.writeText(url)
      } catch {
        /* ignore */
      }
    } catch (err) {
      setCreateError(err.message || 'Something went wrong. Try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Artist Invites</h1>
            <p>Create private invite links for prospective artists</p>
          </div>
          {activeCount > 0 && (
            <span className="badge" style={{ fontSize: 14, padding: '8px 14px' }}>
              {activeCount} active
            </span>
          )}
        </div>
      </div>

      {isMockMode && (
        <div className="auth-error" style={{ marginBottom: 20, padding: 14 }}>
          Demo mode — invites are saved only in this browser. Create invites on{' '}
          <strong>{getInviteBaseUrl()}/admin/invites</strong> while signed in as admin so links work for artists.
        </div>
      )}

      <div className="card" style={{ padding: 28, marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Create invite</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
          Each link is single-use and expires after the set number of days. Links always use your production URL ({getInviteBaseUrl()}), even when you're running the app locally.
        </p>

        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Artist name (internal label)</label>
              <input className="filter-select" style={{ width: '100%' }} placeholder="Maya Chen" value={artistName} onChange={(e) => setArtistName(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Lock to email (optional)</label>
              <input className="filter-select" type="email" style={{ width: '100%' }} placeholder="artist@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Expires in (days)</label>
              <input className="filter-select" type="number" min={1} max={365} style={{ width: '100%' }} value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Internal note (optional)</label>
            <input className="filter-select" style={{ width: '100%' }} placeholder="Referred by Nike creative team" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {createError && <div className="auth-error" style={{ marginBottom: 16 }}>{createError}</div>}

          {lastCreatedUrl && (
            <div style={{ padding: 14, marginBottom: 16, borderRadius: 'var(--radius-md)', border: '1px solid rgba(52, 211, 153, 0.3)', background: 'rgba(52, 211, 153, 0.08)', fontSize: 13 }}>
              <strong style={{ color: 'var(--success)' }}>Invite created — link copied to clipboard</strong>
              <code style={{ display: 'block', marginTop: 8, wordBreak: 'break-all', fontSize: 12 }}>{lastCreatedUrl}</code>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Generate invite link'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['active', 'used', 'expired', 'all'].map((status) => (
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

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading invites…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No {filter === 'all' ? '' : filter} invites yet. Create one above to send to your first artists.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((invite) => (
            <InviteRow key={invite.id} invite={invite} onDelete={() => refetch({ silent: true })} />
          ))}
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        Send each artist their private link directly. They won't be able to apply without it. Review submissions in{' '}
        <Link to="/admin/applications" style={{ color: 'var(--gold)' }}>Applications</Link>.
      </p>
    </div>
  )
}
