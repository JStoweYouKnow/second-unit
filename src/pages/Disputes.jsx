import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Plus, X, Upload, Loader2, Shield } from '../components/icons'
import { useDisputes } from '../hooks/useDisputes'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../hooks/useBookings'
import { useApp } from '../context/AppContext'
import { uploadDisputeEvidence } from '../lib/disputeEvidence'
import { isSupabaseConfigured } from '../lib/supabase'

const STATUS_LABELS = {
  open: 'Open',
  under_review: 'Under review',
  mediation: 'Mediation',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default function Disputes() {
  const { isAuthenticated } = useAuth()
  const { disputes, loading, openDispute, addEvidence, refetch } = useDisputes(isAuthenticated)
  const { bookings } = useBookings(isAuthenticated)
  const { localProjects } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(null)
  const [showOpen, setShowOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [form, setForm] = useState({
    title: '',
    reason: 'Quality / deliverables',
    description: '',
    bookingId: '',
    contractId: '',
  })

  const selected = disputes.find((d) => d.id === selectedId) || null

  const disputableBookings = useMemo(
    () => bookings.filter((b) => ['confirmed', 'paid', 'completed'].includes(b.status)),
    [bookings]
  )

  const disputableContracts = useMemo(
    () => localProjects.filter((c) => c.status === 'active' || c.status === 'completed'),
    [localProjects]
  )

  useEffect(() => {
    const openBooking = searchParams.get('booking')
    const openContract = searchParams.get('contract')
    const id = searchParams.get('id')
    if (id) setSelectedId(id)
    if (openBooking || openContract) {
      setShowOpen(true)
      setForm((f) => ({
        ...f,
        bookingId: openBooking || '',
        contractId: openContract || '',
        title: openBooking
          ? `Dispute — booking ${openBooking.slice(0, 8)}`
          : openContract
            ? `Dispute — contract ${openContract.slice(0, 8)}`
            : f.title,
      }))
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleOpenDispute = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const created = await openDispute({
        title: form.title.trim(),
        reason: form.reason,
        description: form.description.trim(),
        bookingId: form.bookingId || null,
        contractId: form.contractId || null,
      })
      setShowOpen(false)
      setSelectedId(created.id)
      setForm({ title: '', reason: 'Quality / deliverables', description: '', bookingId: '', contractId: '' })
    } catch (err) {
      setError(err.message || 'Failed to open dispute')
    } finally {
      setBusy(false)
    }
  }

  const handleAddEvidence = async (e) => {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await addEvidence(selected.id, { note: evidenceNote.trim() || 'Additional evidence submitted.' })
      setEvidenceNote('')
      await refetch()
    } catch (err) {
      setError(err.message || 'Failed to add evidence')
    } finally {
      setBusy(false)
    }
  }

  const handleEvidenceFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selected || !isSupabaseConfigured) return
    setBusy(true)
    try {
      const path = await uploadDisputeEvidence(selected.id, file)
      await addEvidence(selected.id, {
        note: `Uploaded file: ${file.name}`,
        fileName: file.name,
        storagePath: path,
        mimeType: file.type,
      })
      await refetch()
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Disputes</h1>
            <p>Open a mediation case if deliverables, payment, or scope need platform review.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowOpen(true)}>
            <Plus size={16} /> Open dispute
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : disputes.length === 0 ? (
            <div className="card" style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>
              No disputes yet.
            </div>
          ) : (
            disputes.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`card ${selectedId === d.id ? 'card-glow' : ''}`}
                style={{ textAlign: 'left', padding: 16, cursor: 'pointer' }}
                onClick={() => setSelectedId(d.id)}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{STATUS_LABELS[d.status] || d.status}</div>
              </button>
            ))
          )}
        </div>

        <div className="card" style={{ padding: 24, minHeight: 320 }}>
          {!selected ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 48 }}>
              <Shield size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
              <p>Select a dispute or open a new case.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, marginBottom: 4 }}>{selected.title}</h2>
                  <span className="skill-tag">{STATUS_LABELS[selected.status]}</span>
                  {selected.outcome !== 'pending' && (
                    <span className="skill-tag" style={{ marginLeft: 8 }}>Outcome: {selected.outcome}</span>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                <strong>Reason:</strong> {selected.reason}
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{selected.description}</p>

              {selected.resolutionNotes && (
                <div style={{ padding: 16, background: 'var(--success-muted-bg)', borderRadius: 8, marginBottom: 20 }}>
                  <strong>Resolution</strong>
                  <p style={{ margin: '8px 0 0', fontSize: 14 }}>{selected.resolutionNotes}</p>
                </div>
              )}

              <h3 style={{ fontSize: 15, marginBottom: 12 }}>Evidence</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {(selected.evidence || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No evidence submitted yet.</p>
                ) : (
                  selected.evidence.map((ev) => (
                    <div key={ev.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                      {ev.note}
                      {ev.fileName && (
                        <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>File: {ev.fileName}</div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {['open', 'under_review', 'mediation'].includes(selected.status) && (
                <form onSubmit={handleAddEvidence} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Add a note or describe new evidence…"
                    value={evidenceNote}
                    onChange={(e) => setEvidenceNote(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
                      Submit note
                    </button>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      <Upload size={14} /> Upload file
                      <input type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx" onChange={handleEvidenceFile} />
                    </label>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {showOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Open dispute</h2>
              <button type="button" className="btn-icon" onClick={() => setShowOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleOpenDispute}>
              <div className="form-group">
                <label className="form-label">Linked booking</label>
                <select className="form-input" value={form.bookingId} onChange={(e) => setForm((f) => ({ ...f, bookingId: e.target.value, contractId: '' }))}>
                  <option value="">None</option>
                  {disputableBookings.map((b) => (
                    <option key={b.id} value={b.id}>{b.type} — {b.date} (${b.agreedTotal})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Linked contract</label>
                <select className="form-input" value={form.contractId} onChange={(e) => setForm((f) => ({ ...f, contractId: e.target.value, bookingId: '' }))}>
                  <option value="">None</option>
                  {disputableContracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <select className="form-input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
                  <option>Quality / deliverables</option>
                  <option>Payment / milestone</option>
                  <option>Scope change</option>
                  <option>Communication / no-show</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={4} required minLength={10} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the issue and desired outcome…" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy || (!form.bookingId && !form.contractId)}>
                {busy ? 'Submitting…' : 'Submit dispute'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
