import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Plus, X, Send, MapPin, DollarSign, Users, CheckCircle, Loader2, ChevronRight, Upload, Download } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { briefs as briefsApi } from '../lib/api'
import { formatBudgetRange } from '../lib/pricing'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  uploadBriefNda,
  downloadBriefNda,
  isAllowedBriefNdaFile,
  MAX_BRIEF_NDA_BYTES,
} from '../lib/briefNda'

const EMPTY_POST = { title: '', description: '', budget: '', timeline: '', location: 'Remote', skills: '', visibility: 'public' }

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
  const [ndaUpload, setNdaUpload] = useState(null)
  const [ndaUploadError, setNdaUploadError] = useState('')
  const ndaInputRef = useRef(null)

  const [applyFor, setApplyFor] = useState(null)
  const [applyForm, setApplyForm] = useState({ message: '', proposedRate: '', ndaAccepted: false })
  const [ndaAcceptBusy, setNdaAcceptBusy] = useState(false)
  const [applyBusy, setApplyBusy] = useState(false)

  const [activeBrief, setActiveBrief] = useState(null) // hirer: brief detail w/ applications
  const [artistBrief, setArtistBrief] = useState(null) // artist: brief detail w/ own application
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

  const openArtistBrief = useCallback(async (id) => {
    setDetailBusy(true)
    try {
      const data = await briefsApi.get(id)
      setArtistBrief(data)
    } catch (err) {
      setError(err.message || 'Failed to load brief')
    } finally {
      setDetailBusy(false)
    }
  }, [])

  // Deep link from notifications: /briefs?id=<briefId>
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    if (isArtist) openArtistBrief(id)
    else openApplicants(id)
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next, { replace: true })
  }, [searchParams, isArtist, openApplicants, openArtistBrief, setSearchParams])

  const discardNdaUpload = useCallback(() => {
    setNdaUpload((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
      return null
    })
  }, [])

  const handleNdaFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNdaUploadError('')
    if (file.size > MAX_BRIEF_NDA_BYTES) {
      setNdaUploadError('File must be 15MB or smaller.')
      return
    }
    if (!isAllowedBriefNdaFile(file)) {
      setNdaUploadError('Use a PDF (.pdf) or Word file (.doc, .docx).')
      return
    }
    setNdaUpload((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
      return {
        name: file.name,
        file,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        objectUrl: URL.createObjectURL(file),
      }
    })
  }

  const handleDownloadNda = async (brief) => {
    if (!brief?.ndaStoragePath) return
    try {
      await downloadBriefNda(brief.ndaStoragePath, brief.ndaName || 'nda')
    } catch (err) {
      setError(err.message || 'Failed to download NDA')
    }
  }

  const closePostModal = () => {
    setShowPost(false)
    discardNdaUpload()
    setNdaUploadError('')
  }

  const handlePost = async (e) => {
    e.preventDefault()
    setPosting(true)
    setError('')
    try {
      const num = (v) => {
        const n = Math.round(Number(String(v).replace(/,/g, '')))
        return Number.isFinite(n) && n > 0 ? n : null
      }
      const created = await briefsApi.create({
        title: postForm.title.trim(),
        description: postForm.description.trim(),
        budget: num(postForm.budget),
        timeline: postForm.timeline.trim() || null,
        location: postForm.location.trim() || 'Remote',
        skills: postForm.skills.split(',').map((s) => s.trim()).filter(Boolean),
        visibility: postForm.visibility,
      })
      if (ndaUpload?.file && created?.id && isSupabaseConfigured) {
        const storagePath = await uploadBriefNda(created.id, ndaUpload.file)
        await briefsApi.update(created.id, {
          ndaStoragePath: storagePath,
          ndaName: ndaUpload.name,
          ndaMime: ndaUpload.mimeType,
        })
      }
      closePostModal()
      setPostForm(EMPTY_POST)
      await load()
    } catch (err) {
      const msg = err.message || 'Failed to post brief'
      setError(msg)
      if (ndaUpload?.file) {
        setNdaUploadError(msg.includes('NDA') || msg.includes('Storage')
          ? msg
          : 'If the brief was created, the NDA may not have uploaded. Try posting again without the file or contact support.')
      }
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
        ndaAccepted: applyFor.ndaStoragePath ? applyForm.ndaAccepted : false,
      })
      setApplyFor(null)
      setApplyForm({ message: '', proposedRate: '', ndaAccepted: false })
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

  const handleAcceptNda = async (brief) => {
    if (!brief?.id) return
    setNdaAcceptBusy(true)
    setError('')
    try {
      await briefsApi.acceptNda(brief.id)
      await load()
      if (artistBrief?.id === brief.id) {
        const data = await briefsApi.get(brief.id)
        setArtistBrief(data)
      }
    } catch (err) {
      setError(err.message || 'Could not accept NDA')
    } finally {
      setNdaAcceptBusy(false)
    }
  }

  const visibilityPill = (visibility) => {
    const map = {
      public: { label: 'Public', bg: 'var(--surface)', color: 'var(--text-muted)' },
      nda_gated: { label: 'NDA required', bg: 'var(--accent-tint-10)', color: 'var(--accent)' },
      invite_only: { label: 'Invite only', bg: 'var(--surface)', color: 'var(--text-secondary)' },
    }
    const s = map[visibility] || map.public
    return (
      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    )
  }

  const openApplyFlow = (b) => {
    if (b.visibility === 'nda_gated' && b.descriptionRedacted && !b.ndaAcceptedAt) {
      openArtistBrief(b.id)
      return
    }
    setApplyForm({ message: '', proposedRate: '', ndaAccepted: false })
    setApplyFor(b)
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

  const applicationStatusPill = (status) => {
    const map = {
      pending: { bg: 'var(--success-muted-bg)', color: 'var(--success)', label: 'Applied' },
      shortlisted: { bg: 'var(--accent-tint-10)', color: 'var(--accent)', label: 'Shortlisted' },
      accepted: { bg: 'var(--success-muted-bg)', color: 'var(--success)', label: 'Accepted' },
      declined: { bg: 'var(--surface)', color: 'var(--text-muted)', label: 'Declined' },
    }
    const s = map[status] || map.pending
    return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
  }

  const artistBriefs = isArtist ? list.filter((b) => b.applied) : []
  const browseBriefs = isArtist ? list.filter((b) => !b.applied && b.status === 'open') : list

  const renderBriefCard = (b) => (
    <article key={b.id} className="card slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 16 }}>{b.title}</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {b.visibility && b.visibility !== 'public' && visibilityPill(b.visibility)}
          {b.applied && b.applicationStatus && applicationStatusPill(b.applicationStatus)}
          {statusPill(b.status)}
        </div>
      </div>
      {!isArtist ? null : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.employerName}</div>
      )}
      {b.description && (
        <p style={{ fontSize: 13, color: b.descriptionRedacted ? 'var(--text-muted)' : 'var(--text-secondary)', fontStyle: b.descriptionRedacted ? 'italic' : 'normal', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {b.description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={14} /> {formatBudgetRange(b.budget ?? b.budgetMin, b.budget ?? b.budgetMax)}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {b.location || 'Remote'}</span>
        {b.timeline && <span>Timeline: {b.timeline}</span>}
      </div>
      {b.skills?.length > 0 && (
        <div className="artist-skills">
          {b.skills.map((s) => <span key={s} className="skill-tag">{s}</span>)}
        </div>
      )}
      {b.ndaStoragePath && (b.canDownloadNda !== false) && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => handleDownloadNda(b)}>
          <Download size={14} /> NDA / MNDA{b.ndaName ? `: ${b.ndaName}` : ''}
        </button>
      )}
      <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isArtist ? (
          b.applied ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openArtistBrief(b.id)}>
              View application <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled={b.status !== 'open'} onClick={() => openApplyFlow(b)}>
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
  )

  const renderBriefGrid = (items) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
      {items.map(renderBriefCard)}
    </div>
  )

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
      ) : isArtist ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {artistBriefs.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>Your applications</h2>
              {renderBriefGrid(artistBriefs)}
            </section>
          )}
          {browseBriefs.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>
                {artistBriefs.length > 0 ? 'Browse open briefs' : 'Open briefs'}
              </h2>
              {renderBriefGrid(browseBriefs)}
            </section>
          )}
          {artistBriefs.length === 0 && browseBriefs.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <FileText size={30} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p>No open briefs right now. Check back soon.</p>
            </div>
          )}
        </div>
      ) : (
        renderBriefGrid(list)
      )}

      {/* Post a brief (hirer) */}
      {showPost && (
        <div className="modal-overlay" role="presentation" onClick={closePostModal}>
          <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post an open brief</h2>
              <button type="button" className="btn-icon" onClick={closePostModal}><X size={18} /></button>
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
              <div className="form-group">
                <label className="form-label">Budget (USD, optional)</label>
                <input className="form-input" type="number" min={0} value={postForm.budget} placeholder="e.g. 5000"
                  onChange={(e) => setPostForm((p) => ({ ...p, budget: e.target.value }))} />
              </div>
              <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
              <div className="form-group">
                <label className="form-label">Confidentiality</label>
                <select
                  className="form-input"
                  value={postForm.visibility}
                  onChange={(e) => setPostForm((p) => ({ ...p, visibility: e.target.value }))}
                >
                  <option value="public">Public — full brief visible to all artists</option>
                  <option value="nda_gated">NDA gated — summary until NDA accepted</option>
                  <option value="invite_only">Invite only — hidden until artist applies</option>
                </select>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.45 }}>
                  For sensitive work, use NDA gated or invite only and keep client names out of the public description.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">NDA / MNDA <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.45 }}>
                  Upload a mutual or one-way NDA for artists to review before applying. PDF or Word, max 15MB.
                </p>
                <input
                  ref={ndaInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  aria-label="Upload NDA or MNDA"
                  onChange={handleNdaFileChange}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => ndaInputRef.current?.click()}>
                    <Upload size={16} /> Choose file
                  </button>
                  {ndaUpload && (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{ndaUpload.name}</strong>
                      ({(ndaUpload.size / 1024).toFixed(1)} KB)
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { discardNdaUpload(); setNdaUploadError('') }}>
                        Remove
                      </button>
                    </span>
                  )}
                </div>
                {ndaUploadError && (
                  <div className="auth-error" style={{ marginTop: 10 }} role="alert">{ndaUploadError}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closePostModal} disabled={posting}>Cancel</button>
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
              {applyFor.ndaStoragePath && (
                <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)' }}>
                  This brief includes a confidentiality agreement. Download and accept it before applying.
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10, marginRight: 8 }} onClick={() => handleDownloadNda(applyFor)}>
                    <Download size={14} /> Download NDA / MNDA
                  </button>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={applyForm.ndaAccepted}
                      onChange={(e) => setApplyForm((p) => ({ ...p, ndaAccepted: e.target.checked }))}
                      required
                    />
                    <span>I have read and accept the NDA / MNDA for this brief.</span>
                  </label>
                </div>
              )}
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
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatBudgetRange(activeBrief.budget ?? activeBrief.budgetMin, activeBrief.budget ?? activeBrief.budgetMax)}</span>
              {activeBrief.ndaStoragePath && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDownloadNda(activeBrief)}>
                  <Download size={14} /> NDA / MNDA
                </button>
              )}
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

      {/* Application detail (artist) */}
      {artistBrief && (
        <div className="modal-overlay" role="presentation" onClick={() => setArtistBrief(null)}>
          <div className="modal modal-lg" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>{artistBrief.title}</h2>
              <button type="button" className="btn-icon" onClick={() => setArtistBrief(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {artistBrief.myApplication?.status && applicationStatusPill(artistBrief.myApplication.status)}
              {statusPill(artistBrief.status)}
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatBudgetRange(artistBrief.budget ?? artistBrief.budgetMin, artistBrief.budget ?? artistBrief.budgetMax)}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{artistBrief.location || 'Remote'}</span>
            </div>
            {artistBrief.descriptionRedacted && artistBrief.ndaStoragePath && !artistBrief.ndaAcceptedAt && (
              <div style={{ marginBottom: 16, padding: 16, background: 'var(--accent-tint-10)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                  This brief is confidential. Download the NDA, then accept it to view the full description and apply.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDownloadNda(artistBrief)}>
                    <Download size={14} /> Download NDA
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={ndaAcceptBusy} onClick={() => handleAcceptNda(artistBrief)}>
                    {ndaAcceptBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Accept NDA
                  </button>
                </div>
              </div>
            )}
            {artistBrief.description && (
              <p style={{ fontSize: 14, color: artistBrief.descriptionRedacted ? 'var(--text-muted)' : 'var(--text-secondary)', fontStyle: artistBrief.descriptionRedacted ? 'italic' : 'normal', whiteSpace: 'pre-wrap', marginBottom: 16 }}>{artistBrief.description}</p>
            )}
            {artistBrief.ndaStoragePath && artistBrief.canDownloadNda !== false && !artistBrief.descriptionRedacted && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => handleDownloadNda(artistBrief)}>
                <Download size={14} /> Download NDA / MNDA
              </button>
            )}
            {artistBrief.myApplication ? (
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 10 }}>Your application</h3>
                {artistBrief.myApplication.proposedRate != null && (
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>${Number(artistBrief.myApplication.proposedRate).toLocaleString()}</div>
                )}
                {artistBrief.myApplication.message && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{artistBrief.myApplication.message}</p>
                )}
                {artistBrief.myApplication.status === 'accepted' && (
                  <p style={{ fontSize: 13, color: 'var(--success)', marginTop: 12 }}>
                    You were selected for this brief. The hirer may follow up in Messages or Projects.
                  </p>
                )}
                {artistBrief.myApplication.status === 'declined' && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
                    This brief has moved forward with other applicants. Keep browsing open briefs for new opportunities.
                  </p>
                )}
              </div>
            ) : artistBrief.status === 'open' && !artistBrief.descriptionRedacted ? (
              <button type="button" className="btn btn-primary" onClick={() => { setArtistBrief(null); openApplyFlow(artistBrief) }}>
                <Send size={16} /> Apply to this brief
              </button>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>You haven&apos;t applied to this brief yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
