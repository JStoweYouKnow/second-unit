import { useState, useEffect } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { Shield, Loader2, CheckCircle } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { useDisputes } from '../hooks/useDisputes'

const OUTCOMES = [
  { id: 'refund_employer', label: 'Refund employer' },
  { id: 'release_artist', label: 'Release to artist' },
  { id: 'split', label: 'Split / partial' },
  { id: 'no_action', label: 'No action' },
]

export default function AdminDisputes() {
  const { isAdmin } = useAuth()
  const { disputes, loading, resolveDispute, refetch } = useDisputes(isAdmin)
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(null)
  const [outcome, setOutcome] = useState('no_action')
  const [notes, setNotes] = useState('')
  const [splitEmployer, setSplitEmployer] = useState('')
  const [splitArtist, setSplitArtist] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const openDisputes = disputes.filter((d) => d.status !== 'resolved' && d.status !== 'closed')
  const selected = disputes.find((d) => d.id === selectedId) || openDisputes[0] || null

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) setSelectedId(id)
  }, [searchParams])

  if (!isAdmin) return <Navigate to="/" replace />

  const handleResolve = async (e) => {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setMsg('')
    try {
      const payload = {
        outcome,
        resolutionNotes: notes.trim(),
      }
      if (outcome === 'split') {
        payload.splitEmployerCents = Math.round(parseFloat(splitEmployer || '0') * 100)
        payload.splitArtistCents = Math.round(parseFloat(splitArtist || '0') * 100)
      }
      const resolved = await resolveDispute(selected.id, payload)
      const payoutNote = resolved.payoutError
        ? ` Resolved with payout warnings: ${resolved.payoutError}`
        : resolved.payoutStatus === 'executed'
          ? ' Stripe payout executed.'
          : ''
      setMsg(`Dispute resolved.${payoutNote}`)
      setNotes('')
      setSplitEmployer('')
      setSplitArtist('')
      await refetch()
    } catch (err) {
      setMsg(err.message || 'Failed to resolve')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dispute arbitration</h1>
        <p>Review open cases, evidence, and record binding outcomes with automated Stripe refunds/releases.</p>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openDisputes.length === 0 ? (
              <div className="card" style={{ padding: 20, color: 'var(--text-muted)' }}>No open disputes.</div>
            ) : (
              openDisputes.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="card"
                  style={{ padding: 14, textAlign: 'left', borderColor: selected?.id === d.id ? 'var(--accent)' : undefined }}
                  onClick={() => setSelectedId(d.id)}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.status}</div>
                </button>
              ))
            )}
          </div>

          {selected ? (
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>{selected.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{selected.description}</p>

              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Evidence ({selected.evidence?.length || 0})</h3>
              <div style={{ marginBottom: 20 }}>
                {(selected.evidence || []).map((ev) => (
                  <div key={ev.id} style={{ fontSize: 13, padding: 10, borderBottom: '1px solid var(--border)' }}>
                    {ev.note}
                    {ev.fileName && <span style={{ color: 'var(--text-muted)' }}> — {ev.fileName}</span>}
                  </div>
                ))}
              </div>

              {selected.status !== 'resolved' && (
                <form onSubmit={handleResolve}>
                  <div className="form-group">
                    <label className="form-label">Outcome</label>
                    <select className="form-input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                      {OUTCOMES.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {outcome === 'split' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Refund to employer ($)</label>
                        <input className="form-input" type="number" min="0" step="0.01" value={splitEmployer} onChange={(e) => setSplitEmployer(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Release to artist ($)</label>
                        <input className="form-input" type="number" min="0" step="0.01" value={splitArtist} onChange={(e) => setSplitArtist(e.target.value)} required />
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Resolution notes (shared with both parties)</label>
                    <textarea className="form-input" rows={4} required value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  {msg && <p style={{ fontSize: 13, color: msg.includes('resolved') && !msg.includes('warnings') ? 'var(--success)' : 'var(--danger)', marginBottom: 12 }}>{msg}</p>}
                  <button type="submit" className="btn btn-success" disabled={busy}>
                    <CheckCircle size={16} /> {busy ? 'Saving…' : 'Resolve dispute'}
                  </button>
                </form>
              )}
              {selected.payoutStatus && selected.status === 'resolved' && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
                  Payout: {selected.payoutStatus}{selected.payoutError ? ` — ${selected.payoutError}` : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Shield size={32} style={{ opacity: 0.4 }} />
              <p>Queue is clear.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
