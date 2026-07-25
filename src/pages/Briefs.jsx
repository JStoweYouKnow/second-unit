import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Plus, X, Send, MapPin, DollarSign, Users, CheckCircle, Loader2, ChevronRight } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { briefs as briefsApi } from '../lib/api'
import { formatBudgetRange } from '../lib/pricing'

const EMPTY_POST = { title: '', description: '', budgetMin: '', budgetMax: '', timeline: '', location: 'Remote', skills: '' }

export default function Briefs() {
  const navigate = useNavigate()
  const { effectiveRole } = useAuth()
  const isArtist = effectiveRole === 'artist'
  const [searchParams, setSearchParams] = useSearchParams()

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showPost, setShowPost] = useState(false)
  const [postForm, setPostForm] = useState(EMPTY_POST)
  const [posting, setPosting] = useState(false)

  const [applyFor, setApplyFor] = useState(null)
  const [applyForm, setApplyForm] = useState({ message: '', proposedRate: '' })
  const [applyBusy, setApplyBusy] = useState(false)

  const [activeBrief, setActiveBrief] = useState(null) // hirer: brief detail w/ applications
  const [applicants, setApplicants] = useState([])
  const [detailBusy, setDetailBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await briefsApi.list({ mine: !isArtist })
      setList(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load briefs')
    } finally {
      setLoading(false)
    }
  }, [isArtist])

  useEffect(() => { load() }, [load])

  const openApplicants = useCallback(async (id) => {
    setDetailBusy(true)
    try {
      const data = await briefsApi.get(id)
      setActiveBrief(data)
      setApplicants(Array.isArray(data.applications) ? data.applications : [])
    } catch (err) {
      setError(err.message || 'Failed to load applicants')
    } finally {
      setDetailBusy(false)
    }
  }, [])

  // Deep link from the "new application" notification: /briefs?id=<briefId>
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && !isArtist) {
      openApplicants(id)
      const next = new URLSearchParams(searchParams)
      next.delete('id')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, isArtist, openApplicants, setSearchParams])

  const handlePost = async (e) => {
    e.preventDefault()
    setPosting(true)
    setError('')
    try {
      const num = (v) => {
        const n = Math.round(Number(String(v).replace(/,/g, '')))
        return Number.isFinite(n) && n > 0 ? n : null
      }
      await briefsApi.create({
        title: postForm.title.trim(),
        description: postForm.description.trim(),
        budgetMin: num(postForm.budgetMin),
        budgetMax: num(postForm.budgetMax),
        timeline: postForm.timeline.trim() || null,
        location: postForm.location.trim() || 'Remote',
        skills: postForm.skills.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setShowPost(false)
      setPostForm(EMPTY_POST)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to post brief')
    } finally {
      setPosting(false)
    }
  }

  const handleApply = async (e) => {
    e.preventDefault()
    if (!applyFor) return
    setApplyBusy(true)
    setError('')
    try {
      const rate = Math.round(Number(String(applyForm.proposedRate).replace(/,/g, '')))
      await briefsApi.apply(applyFor.id, {
        message: applyForm.message.trim(),
        proposedRate: Number.isFinite(rate) && rate > 0 ? rate : null,
      })
      setApplyFor(null)
      setApplyForm({ message: '', proposedRate: '' })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to apply')
    } finally {
      setApplyBusy(false)
    }
  }

  const setAppStatus = async (app, status) => {
    if (!activeBrief) return
    setDetailBusy(true)
    try {
      await briefsApi.setApplicationStatus(activeBrief.id, app.id, status)
      if (status === 'accepted') {
        navigate(`/projects?new=1&artistId=${app.artistId}`)
        return
      }
      await openApplicants(activeBrief.id)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to update application')
    } finally {
      setDetailBusy(false)
    }
  }

  const closeBrief = async (brief, status) => {
    setDetailBusy(true)
    try {
      await briefsApi.update(brief.id, { status })
      await load()
      if (activeBrief?.id === brief.id) setActiveBrief((b) => (b ? { ...b, status } : b))
    } catch (err) {
      setError(err.message || 'Failed to update brief')
    } finally {
      setDetailBusy(false)
    }
  }

  const statusPill = (status) => {
    const map = {
      open: { bg: 'var(--success-muted-bg)', color: 'var(--success)', label: 'Open' },
      closed: { bg: 'var(--surface)', color: 'var(--text-muted)', label: 'Closed' },
      filled: { bg: 'var(--accent-tint-10)', color: 'var(--accent)', label: 'Filled' },
    }
    const s = map[status] || map.open
    return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Open Briefs</h1>
            <p>
              {isArtist
                ? 'Browse open production briefs and apply — hirers review applicants and reach out.'
                : 'Post a brief to the network and let vetted artists apply, instead of assigning up front.'}
            </p>
          </div>
          {!isArtist && (
            <button type="button" className="btn btn-primary" onClick={() => setShowPost(true)}>
              <Plus size={16} /> Post a brief
            </button>
          )}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 20 }}>{error}</div>}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px' }} /> Loading briefs…
        </div>
      ) : list.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <FileText size={30} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{isArtist ? 'No open briefs right now. Check back soon.' : 'You haven’t posted any briefs yet.'}</p>
          {!isArtist && (
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowPost(true)}>
              <Plus size={14} /> Post a brief
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {list.map((b) => (
            <article key={b.id} className="card slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <h3 style={{ fontSize: 16 }}>{b.title}</h3>
                {statusPill(b.status)}
              </div>
              {!isArtist ? null : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.employerName}</div>
              )}
              {b.description && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {b.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={14} /> {formatBudgetRange(b.budgetMin, b.budgetMax)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {b.location || 'Remote'}</span>
                {b.timeline && <span>Timeline: {b.timeline}</span>}
              </div>
              {b.skills?.length > 0 && (
                <div className="artist-skills">
                  {b.skills.map((s) => <span key={s} className="skill-tag">{s}</span>)}
                </div>
              )}
              <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {isArtist ? (
                  b.applied ? (
                    <span style={{ fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={14} /> Applied
                    </span>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" disabled={b.status !== 'open'} onClick={() => setApplyFor(b)}>
                      <Send size={14} /> Apply
                    </button>
                  )
                ) : (
                  <>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={14} /> {b.applicationCount || 0} applicant{(b.applicationCount || 0) === 1 ? '' : 's'}
                    </span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openApplicants(b.id)}>
                      View <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Post a brief (hirer) */}
      {showPost && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowPost(false)}>
          <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post an open brief</h2>
              <button type="button" className="btn-icon" onClick={() => setShowPost(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handlePost}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" required value={postForm.title} placeholder="e.g. AI film sequence — 60s brand piece"
                  onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" style={{ minHeight: 120 }} value={postForm.description} placeholder="Scope, references, deliverables, must-haves…"
                  onChange={(e) => setPostForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Budget min ($)</label>
                  <input className="form-input" type="number" min={0} value={postForm.budgetMin}
                    onChange={(e) => setPostForm((p) => ({ ...p, budgetMin: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Budget max ($)</label>
                  <input className="form-input" type="number" min={0} value={postForm.budgetMax}
                    onChange={(e) => setPostForm((p) => ({ ...p, budgetMax: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Timeline</label>
                  <input className="form-input" value={postForm.timeline} placeholder="e.g. 3 weeks, deliver by Aug 30"
                    onChange={(e) => setPostForm((p) => ({ ...p, timeline: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={postForm.location}
                    onChange={(e) => setPostForm((p) => ({ ...p, location: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Skills / roles wanted <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                <input className="form-input" value={postForm.skills} placeholder="e.g. Runway, compositing, sound design"
                  onChange={(e) => setPostForm((p) => ({ ...p, skills: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPost(false)} disabled={posting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={posting}>
                  {posting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Post brief
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply (artist) */}
      {applyFor && (
        <div className="modal-overlay" role="presentation" onClick={() => setApplyFor(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Apply — {applyFor.title}</h2>
              <button type="button" className="btn-icon" onClick={() => setApplyFor(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleApply}>
              <div className="form-group">
                <label className="form-label">Pitch / message</label>
                <textarea className="form-input" style={{ minHeight: 130 }} required value={applyForm.message}
                  placeholder="Why you're a fit, relevant work, availability…"
                  onChange={(e) => setApplyForm((p) => ({ ...p, message: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Proposed rate (USD, optional)</label>
                <input className="form-input" type="number" min={0} value={applyForm.proposedRate}
                  onChange={(e) => setApplyForm((p) => ({ ...p, proposedRate: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setApplyFor(null)} disabled={applyBusy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={applyBusy}>
                  {applyBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applicants (hirer) */}
      {activeBrief && (
        <div className="modal-overlay" role="presentation" onClick={() => setActiveBrief(null)}>
          <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>{activeBrief.title}</h2>
              <button type="button" className="btn-icon" onClick={() => setActiveBrief(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {statusPill(activeBrief.status)}
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatBudgetRange(activeBrief.budgetMin, activeBrief.budgetMax)}</span>
              {activeBrief.status === 'open' && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} disabled={detailBusy} onClick={() => closeBrief(activeBrief, 'closed')}>
                  Close brief
                </button>
              )}
              {activeBrief.status === 'closed' && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} disabled={detailBusy} onClick={() => closeBrief(activeBrief, 'open')}>
                  Reopen
                </button>
              )}
            </div>

            <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {applicants.length} applicant{applicants.length === 1 ? '' : 's'}
            </h3>
            {applicants.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No applications yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {applicants.map((app) => (
                  <div key={app.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{app.artistName}</div>
                        {app.artistRole && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{app.artistRole}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {app.proposedRate != null && <div style={{ fontWeight: 700 }}>${Number(app.proposedRate).toLocaleString()}</div>}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.status}</div>
                      </div>
                    </div>
                    {app.message && <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 10 }}>{app.message}</p>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {app.artistId && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/artist/${app.artistId}`)}>View profile</button>
                      )}
                      {app.status !== 'shortlisted' && app.status !== 'accepted' && (
                        <button type="button" className="btn btn-secondary btn-sm" disabled={detailBusy} onClick={() => setAppStatus(app, 'shortlisted')}>Shortlist</button>
                      )}
                      {app.status !== 'declined' && app.status !== 'accepted' && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={detailBusy} onClick={() => setAppStatus(app, 'declined')}>Decline</button>
                      )}
                      {app.status !== 'accepted' && (
                        <button type="button" className="btn btn-success btn-sm" disabled={detailBusy} onClick={() => setAppStatus(app, 'accepted')}>
                          <CheckCircle size={14} /> Accept &amp; create project
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
