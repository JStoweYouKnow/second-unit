import { useMemo, useState, useRef, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FileText, Plus, Download, Eye, CheckCircle, Clock, Archive, X, PenTool, Shield, Copy, Check, Upload, Receipt } from '../components/icons'
import { ContractMilestonesPanel } from '../components/ContractMilestonesPanel'
import { useArtists } from '../hooks/useData'
import { useArtistProfile } from '../hooks/useArtistProfile'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { isArtistProfile, demoArtistPersona } from '../lib/roleView'
import { contracts as contractsApi } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import { splitMilestoneAmounts, DEFAULT_MILESTONE_TITLES } from '../lib/milestones'

const STANDARD_TERMS = `INDEPENDENT CONTRACTOR AGREEMENT

This Agreement ("Agreement") is entered into as of the Start Date specified below.

1. SCOPE OF WORK
The Artist agrees to provide the creative services described in this contract, including all deliverables outlined at the time of booking.

2. COMPENSATION & PAYMENT
• Payment shall be made according to the following milestone schedule:
  - 33% upon contract execution
  - 33% upon delivery of first draft/proof
  - 34% upon final approval and delivery
• All payments processed through The Callsheet's platform via Stripe.
• Late payments are subject to a 1.5% monthly interest charge.

3. INTELLECTUAL PROPERTY
• All IP rights transfer to the Client upon receipt of full payment.
• Artist retains the right to display the work in their portfolio.
• Client grants Artist permission to use work samples for promotional purposes unless otherwise specified.

4. REVISIONS
• Two (2) rounds of revisions are included in the base fee.
• Additional revision rounds billed at the Artist's standard hourly rate.

5. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary information shared during the engagement. This obligation survives termination of this Agreement.

6. CANCELLATION POLICY
• Either party may terminate with 14 days written notice.
• If Client cancels after work has begun, Client pays for all completed work.
• If Artist cancels, all payments for undelivered work shall be refunded.

7. LIABILITY
• Artist's total liability shall not exceed the total contract value.
• Neither party shall be liable for indirect, incidental, or consequential damages.

8. DISPUTE RESOLUTION
Any disputes shall first be addressed through mediation. If mediation fails, disputes shall be resolved through binding arbitration.

9. GOVERNING LAW
This Agreement shall be governed by the laws of the state specified by the Client.

10. ENTIRE AGREEMENT
This document constitutes the entire agreement between the parties and supersedes all prior negotiations and agreements.`

const MAX_CUSTOM_FILE_BYTES = 15 * 1024 * 1024 // 15MB

function isAllowedCustomAgreementFile(file) {
  if (!file?.name) return false
  if (/\.(pdf|doc|docx)$/i.test(file.name)) return true
  const mime = (file.type || '').toLowerCase()
  return (
    mime === 'application/pdf' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}

export default function Projects() {
  const { profile } = useAuth()
  const { allMessages, sendMessage, localProjects, createContract, signContract, signContractAsArtist, payMilestone, approveMilestone, refetchContracts } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [milestoneBusy, setMilestoneBusy] = useState(null)
  const isArtist = isArtistProfile(profile)
  const { artist: myArtistRecord } = useArtistProfile(profile?.id)
  const me = demoArtistPersona(profile, myArtistRecord)
  const { artists } = useArtists()
  const [showNew, setShowNew] = useState(false)
  const [showView, setShowView] = useState(null) // project to view
  const [showSign, setShowSign] = useState(null) // project to sign
  const [projectType, setProjectType] = useState('standard')
  const [newProject, setNewProject] = useState({
    title: '', artistId: '', startDate: '', endDate: '', value: '', customTerms: '',
    milestone1: '', milestone2: '', milestone3: '',
  })
  const [useCustomMilestones, setUseCustomMilestones] = useState(false)
  /** Pending upload in the modal only (blob URL revoked on discard). On create, URL is kept on the contract row. */
  const [customAgreementUpload, setCustomAgreementUpload] = useState(null)
  const [customUploadError, setCustomUploadError] = useState('')
  const customAgreementInputRef = useRef(null)
  const [signatureName, setSignatureName] = useState('')
  const [signatureAgreed, setSignatureAgreed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reuploadError, setReuploadError] = useState('')
  const reuploadInputRef = useRef(null)

  useEffect(() => {
    const paid = searchParams.get('milestone_paid')
    const contractId = searchParams.get('contract_id')
    if (!contractId) return

    refetchContracts().then((list) => {
      const c = (list || localProjects).find((p) => String(p.id) === contractId)
      if (c) setShowView(c)
      if (paid) setSearchParams({}, { replace: true })
    })
  }, [searchParams])

  const handlePayMilestone = async (contract, milestone) => {
    setMilestoneBusy(milestone.id)
    try {
      const { url } = await payMilestone(contract.id, milestone.id)
      if (url) window.location.href = url
      else await refetchContracts()
    } catch (err) {
      console.error(err)
    } finally {
      setMilestoneBusy(null)
    }
  }

  const handleApproveMilestone = async (contract, milestone) => {
    setMilestoneBusy(milestone.id)
    try {
      await approveMilestone(contract.id, milestone.id)
      const list = await refetchContracts()
      const refreshed = list?.find((p) => p.id === contract.id)
      if (refreshed) setShowView(refreshed)
    } catch (err) {
      console.error(err)
    } finally {
      setMilestoneBusy(null)
    }
  }

  const statusConfig = {
    active: { icon: <CheckCircle size={14} />, color: 'var(--success)', label: 'Active' },
    pending: { icon: <Clock size={14} />, color: 'var(--warning)', label: 'Pending Signature' },
    completed: { icon: <Archive size={14} />, color: 'var(--text-muted)', label: 'Completed' },
    draft: { icon: <FileText size={14} />, color: 'var(--text-secondary)', label: 'Draft' },
  }

  function discardCustomAgreementUpload() {
    setCustomAgreementUpload((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
      return null
    })
  }

  function closeNewProjectModal() {
    discardCustomAgreementUpload()
    setCustomUploadError('')
    setProjectType('standard')
    setNewProject({ title: '', artistId: '', startDate: '', endDate: '', value: '', customTerms: '' })
    setShowNew(false)
  }

  function handleCustomAgreementFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCustomUploadError('')
    if (file.size > MAX_CUSTOM_FILE_BYTES) {
      setCustomUploadError('File must be 15MB or smaller.')
      return
    }
    if (!isAllowedCustomAgreementFile(file)) {
      setCustomUploadError('Use a PDF (.pdf) or Word file (.doc, .docx).')
      return
    }
    setCustomAgreementUpload((prev) => {
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

  const handleCreateProject = async (e) => {
    e.preventDefault()
    const hasCustomText = newProject.customTerms.trim().length > 0
    const hasCustomFile = !!customAgreementUpload
    if (projectType === 'custom' && !hasCustomText && !hasCustomFile) {
      setCustomUploadError('Add terms in the text area or upload a PDF / Word document.')
      return
    }
    setCustomUploadError('')

    const artist = artists.find((a) => String(a.id) === String(newProject.artistId))
    if (!artist) return

    let terms = STANDARD_TERMS
    let attachmentUrl = null
    let attachmentName = null
    let attachmentMime = null
    const pendingFile = customAgreementUpload?.file ?? null

    if (projectType === 'custom') {
      const parts = []
      if (hasCustomText) parts.push(newProject.customTerms.trim())
      if (hasCustomFile) {
        const kb = (customAgreementUpload.size / 1024).toFixed(1)
        parts.push(
          `[Uploaded agreement: ${customAgreementUpload.name} — ${kb} KB]\nUse “Download attachment” on this project to retrieve the PDF or Word file.`
        )
        if (!isSupabaseConfigured) {
          attachmentUrl = customAgreementUpload.objectUrl
        }
        attachmentName = customAgreementUpload.name
        attachmentMime = customAgreementUpload.mimeType
      }
      terms = parts.join('\n\n---\n\n')
    }

    const totalValue = parseInt(newProject.value, 10) || 0
    const defaultSplits = splitMilestoneAmounts(totalValue)
    const milestoneAmounts = useCustomMilestones
      ? [
          parseInt(newProject.milestone1, 10) || 0,
          parseInt(newProject.milestone2, 10) || 0,
          parseInt(newProject.milestone3, 10) || 0,
        ]
      : defaultSplits

    if (useCustomMilestones && milestoneAmounts.reduce((a, b) => a + b, 0) !== totalValue) {
      setCustomUploadError('Milestone amounts must sum to the contract value.')
      return
    }

    const created = await createContract({
      title: newProject.title,
      artistId: artist.id,
      artistName: artist.name,
      clientName: profile?.full_name || 'Client',
      type: projectType,
      value: totalValue,
      startDate: newProject.startDate,
      endDate: newProject.endDate,
      terms,
      attachmentUrl,
      attachmentName,
      attachmentMime,
      milestoneAmounts,
    })

    if (pendingFile && created?.id && isSupabaseConfigured) {
      try {
        const storagePath = await uploadContractAttachment(created.id, pendingFile)
        await contractsApi.updateAttachment(created.id, {
          attachmentStoragePath: storagePath,
          attachmentName: customAgreementUpload.name,
          attachmentMime: customAgreementUpload.mimeType,
        })
        await refetchContracts()
      } catch (uploadErr) {
        console.error('Attachment upload failed:', uploadErr)
        setCustomUploadError('Project created but file upload failed. Try uploading again from the project view.')
        return
      }
    }

    closeNewProjectModal()
  }

  const handleDownloadAttachment = async (contract) => {
    if (contract?.attachmentStoragePath) {
      try {
        await downloadContractAttachment(contract.attachmentStoragePath, contract.attachmentName)
      } catch (err) {
        console.error(err)
      }
      return
    }
    if (!contract?.attachmentUrl || !contract?.attachmentName) return
    const a = document.createElement('a')
    a.href = contract.attachmentUrl
    a.download = contract.attachmentName
    a.rel = 'noopener'
    a.click()
  }

  const handleReuploadAttachment = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !showView?.id) return
    setReuploadError('')
    if (file.size > MAX_CUSTOM_FILE_BYTES) {
      setReuploadError('File must be 15MB or smaller.')
      return
    }
    if (!isAllowedCustomAgreementFile(file)) {
      setReuploadError('Use a PDF (.pdf) or Word file (.doc, .docx).')
      return
    }
    if (!isSupabaseConfigured) {
      setReuploadError('Re-upload requires Supabase Storage.')
      return
    }
    try {
      const storagePath = await uploadContractAttachment(showView.id, file)
      await contractsApi.updateAttachment(showView.id, {
        attachmentStoragePath: storagePath,
        attachmentName: file.name,
        attachmentMime: file.type || 'application/octet-stream',
      })
      const list = await refetchContracts()
      const refreshed = list?.find((p) => p.id === showView.id)
      if (refreshed) setShowView(refreshed)
    } catch (err) {
      setReuploadError(err.message || 'Upload failed')
    }
  }

  const handleSign = async () => {
    if (!signatureName.trim() || !signatureAgreed || !showSign) return

    const updated = isArtist
      ? await signContractAsArtist(showSign.id, signatureName.trim())
      : await signContract(showSign.id, signatureName.trim())

    if (updated) {
      const conv = allMessages.find((m) => m.artistId === updated.artistId)
      if (conv) {
        const sigNote = `✅ AGREEMENT SIGNED\nProject: ${updated.title}\nValue: $${updated.value?.toLocaleString()}\nStatus: ${(updated.status || 'pending').toUpperCase()}\n\nThis copy has been sent to both parties for their records.`
        sendMessage(conv.id, sigNote, isArtist ? 'artist' : 'user')
      }
      if (updated.status === 'active') {
        await refetchContracts()
        setShowView(updated)
      }
    }

    setShowSign(null)
    setSignatureName('')
    setSignatureAgreed(false)
  }

  const handleDownloadPDF = (contract) => {
    // Generate a text-based contract document
    const content = generateContractText(contract)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contract.title.replace(/\s+/g, '_')}_Contract.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadContractInvoice = (contract) => {
    const viewer = profile?.full_name || (isArtist ? 'Artist' : 'Client')
    const roleNote = isArtist
      ? 'Artist copy — financial summary for this engagement (not a tax document).'
      : 'Client copy — financial summary for this booking (not a tax document).'
    const value = contract.value ?? 0
    const third = Math.round(value / 3)
    const remainder = value - third * 2
    const content = `
═══════════════════════════════════════
   THE CALLSHEET — CONTRACT STATEMENT
═══════════════════════════════════════

Statement ref: CNT-${contract.id}
Contract ID: ${contract.id}
Title: ${contract.title}
Agreement type: ${contract.type === 'standard' ? 'Standard' : 'Custom'}

Prepared for: ${viewer}
${roleNote}

───────────────────────────────────────
PARTIES
───────────────────────────────────────
Client: ${profile?.full_name || 'Employer'}
Artist: ${contract.artistName}

───────────────────────────────────────
TERM & VALUE
───────────────────────────────────────
Period: ${contract.startDate} → ${contract.endDate}
Total contract value: $${value.toLocaleString()}

Suggested milestone schedule (per platform terms):
  • On execution:        $${third.toLocaleString()}
  • First draft/proof:   $${third.toLocaleString()}
  • Final delivery:      $${remainder.toLocaleString()}

───────────────────────────────────────
SIGNATURE STATUS
───────────────────────────────────────
Client:  ${contract.signedByEmployer ? 'Signed' : 'Pending'}
Artist:  ${contract.signedByArtist ? 'Signed' : 'Pending'}
Contract status: ${contract.status}

${contract.attachmentName ? `Attached agreement file: ${contract.attachmentName} (download from The Callsheet contract record)\n` : ''}
═══════════════════════════════════════
https://thecallsheet.ai
═══════════════════════════════════════
`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contract.title.replace(/\s+/g, '_')}_Contract_Statement.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyLink = (contract) => {
    navigator.clipboard.writeText(`${window.location.origin}/contracts/${contract.id}`)
    setCopied(contract.id)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayProjects = useMemo(() => {
    if (!isArtist || !me) return localProjects
    return localProjects.filter((p) => p.artistId === me.id)
  }, [isArtist, me, localProjects])

  function generateContractText(contract) {
    const divider = '═'.repeat(60)
    return `${divider}
    THE CALLSHEET — CONTRACT AGREEMENT
${divider}

Contract ID: ${contract.id}
Title: ${contract.title}
Type: ${contract.type === 'standard' ? 'Standard Agreement' : 'Custom Agreement'}

PARTIES
───────
Client: ${profile?.full_name || 'Employer'}
Artist: ${contract.artistName}

TERM
────
Start Date: ${contract.startDate}
End Date: ${contract.endDate}
Total Value: $${contract.value?.toLocaleString()}

${divider}
TERMS AND CONDITIONS
${divider}

${contract.terms || STANDARD_TERMS}
${contract.attachmentName ? `\n\n[Attached file: ${contract.attachmentName} — download from contract record in The Callsheet]\n` : ''}

${divider}
SIGNATURES
${divider}

Client Signature:
${contract.employerSignature
  ? `  Name: ${contract.employerSignature.name}
  Date: ${new Date(contract.employerSignature.date).toLocaleDateString()}
  Status: ✅ Signed electronically`
  : '  ⏳ Awaiting signature'}

Artist Signature:
${contract.artistSignature
  ? `  Name: ${contract.artistSignature.name}
  Date: ${new Date(contract.artistSignature.date).toLocaleDateString()}
  Status: ✅ Signed electronically`
  : '  ⏳ Awaiting signature'}

${divider}
This contract was generated and managed through The Callsheet.
https://thecallsheet.ai
${divider}
`
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Projects</h1>
            <p>{isArtist ? 'Engagements clients have sent you' : 'Manage agreements with your artists'}</p>
          </div>
          {!isArtist && (
            <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={16} /> New Project</button>
          )}
        </div>
      </div>

      {/* Project Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Active', value: displayProjects.filter(c => c.status === 'active').length, color: 'var(--success)' },
          { label: 'Pending Signature', value: displayProjects.filter(c => c.status === 'pending').length, color: 'var(--warning)' },
          { label: 'Completed', value: displayProjects.filter(c => c.status === 'completed').length, color: 'var(--text-muted)' },
          { label: 'Total Value', value: '$' + displayProjects.reduce((s, c) => s + (c.value || 0), 0).toLocaleString(), color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Project List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayProjects.map(c => {
          const s = statusConfig[c.status] || statusConfig.draft
          return (
            <div key={c.id} className="contract-card slide-up">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <FileText size={18} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontSize: 16 }}>{c.title}</h3>
                  <span className="skill-tag">{c.type}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)', alignItems: 'center' }}>
                  <span>{isArtist ? 'Your engagement with the client' : `Artist: ${c.artistName}`}</span>
                  <span>{c.startDate} → {c.endDate}</span>
                  {(c.status === 'active' || c.status === 'completed') && c.milestones?.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {c.milestones.filter((m) => m.status === 'released').length}/{c.milestones.length} milestones released
                    </span>
                  )}
                  {/* Signature Status */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: c.signedByEmployer ? 'var(--success)' : 'var(--text-muted)' }}>
                      <PenTool size={12} /> Client {c.signedByEmployer ? '✓' : '—'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: c.signedByArtist ? 'var(--success)' : 'var(--text-muted)' }}>
                      <PenTool size={12} /> Artist {c.signedByArtist ? '✓' : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right', marginRight: 4 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>${(c.value || 0).toLocaleString()}</div>
                </div>
                <div className={`contract-status ${c.status}`} style={{ color: s.color }}>
                  {s.icon} {s.label}
                </div>
                {c.status === 'pending' && ((!isArtist && !c.signedByEmployer) || (isArtist && !c.signedByArtist)) && (
                  <button type="button" className="btn btn-success btn-sm" onClick={() => setShowSign(c)}>
                    <PenTool size={14} /> Sign Project
                  </button>
                )}
                <button type="button" className="btn-icon" title="View" onClick={() => setShowView(c)}><Eye size={16} /></button>
                <button type="button" className="btn-icon" title="Download contract (.txt)" onClick={() => handleDownloadPDF(c)}><Download size={16} /></button>
                <button type="button" className="btn-icon" title="Download contract statement / invoice (.txt)" onClick={() => handleDownloadContractInvoice(c)}><Receipt size={16} /></button>
                {(c.hasAttachment || c.attachmentUrl) && c.attachmentName && (
                  <button
                    type="button"
                    className="btn-icon"
                    title={`Download ${c.attachmentName}`}
                    onClick={() => handleDownloadAttachment(c)}
                  >
                    <Upload size={16} />
                  </button>
                )}
                <button type="button" className="btn-icon" title="Copy Link" onClick={() => handleCopyLink(c)}>
                  {copied === c.id ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ========== New Contract Modal ========== */}
      {showNew && (
        <div className="modal-overlay" onClick={closeNewProjectModal}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button type="button" className="btn-icon" onClick={closeNewProjectModal}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button
                type="button"
                className={`btn ${projectType === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  discardCustomAgreementUpload()
                  setCustomUploadError('')
                  setProjectType('standard')
                }}
              >
                <FileText size={14} /> Standard Agreement
              </button>
              <button type="button" className={`btn ${projectType === 'custom' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setProjectType('custom')}>
                <PenTool size={14} /> Custom Agreement
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label className="form-label">Project Title</label>
                <input className="form-input" placeholder="e.g., Brand Campaign Q2 2026" value={newProject.title}
                  onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Artist</label>
                <select className="form-input" value={newProject.artistId}
                  onChange={e => setNewProject(p => ({ ...p, artistId: e.target.value }))} required>
                  <option value="">Select an artist...</option>
                  {artists.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={newProject.startDate}
                    onChange={e => setNewProject(p => ({ ...p, startDate: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input className="form-input" type="date" value={newProject.endDate}
                    onChange={e => setNewProject(p => ({ ...p, endDate: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Value ($)</label>
                  <input className="form-input" type="number" placeholder="10000" value={newProject.value}
                    onChange={e => {
                      const value = e.target.value
                      const splits = splitMilestoneAmounts(parseInt(value, 10) || 0)
                      setNewProject(p => ({
                        ...p,
                        value,
                        milestone1: String(splits[0]),
                        milestone2: String(splits[1]),
                        milestone3: String(splits[2]),
                      }))
                    }} required />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={useCustomMilestones} onChange={(e) => setUseCustomMilestones(e.target.checked)} />
                  Custom milestone payment split (default 33/33/34)
                </label>
                {useCustomMilestones && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
                    {DEFAULT_MILESTONE_TITLES.map((m, i) => (
                      <div key={m.title}>
                        <label className="form-label" style={{ fontSize: 11 }}>{m.title} ($)</label>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          value={newProject[`milestone${i + 1}`]}
                          onChange={(e) => setNewProject((p) => ({ ...p, [`milestone${i + 1}`]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {projectType === 'custom' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Upload agreement (PDF or Word)</label>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.45 }}>
                      Optional if you paste terms below — max 15MB. Accepted: .pdf, .doc, .docx
                    </p>
                    <input
                      ref={customAgreementInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      aria-label="Upload PDF or Word agreement"
                      onChange={handleCustomAgreementFileChange}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => customAgreementInputRef.current?.click()}
                      >
                        <Upload size={16} /> Choose file
                      </button>
                      {customAgreementUpload && (
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{customAgreementUpload.name}</strong>
                          ({(customAgreementUpload.size / 1024).toFixed(1)} KB)
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              discardCustomAgreementUpload()
                              setCustomUploadError('')
                            }}
                          >
                            Remove
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custom terms (optional if you upload a document)</label>
                    <textarea
                      className="form-input"
                      placeholder="Paste key terms, scope, or amendments here, or rely on your uploaded PDF / Word file only."
                      style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 13 }}
                      value={newProject.customTerms}
                      onChange={e => setNewProject(p => ({ ...p, customTerms: e.target.value }))}
                    />
                  </div>
                  {customUploadError && (
                    <div className="auth-error" style={{ marginBottom: 16 }} role="alert">
                      {customUploadError}
                    </div>
                  )}
                </>
              )}

              {projectType === 'standard' && (
                <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Standard Agreement Includes:</strong><br />
                  • Scope of work & deliverables<br />
                  • Payment milestones (33/33/34 split)<br />
                  • IP rights transfer upon full payment<br />
                  • 2 rounds of revisions included<br />
                  • 14-day cancellation policy<br />
                  • Confidentiality & NDA clauses
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeNewProjectModal}>Cancel</button>
                <button type="submit" className="btn btn-primary"><FileText size={16} /> Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== View Contract Modal ========== */}
      {showView && (
        <div className="modal-overlay" onClick={() => setShowView(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>{showView.title}</h2>
              <button className="btn-icon" onClick={() => setShowView(null)}><X size={18} /></button>
            </div>

            {/* Contract Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Artist</div>
                <div style={{ fontWeight: 600 }}>{showView.artistName}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Contract Value</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 22 }}>${(showView.value || 0).toLocaleString()}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Term</div>
                <div style={{ fontSize: 14 }}>{showView.startDate} → {showView.endDate}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Type</div>
                <div style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>{showView.type === 'standard' ? <FileText size={13} /> : <PenTool size={13} />}{showView.type === 'standard' ? 'Standard' : 'Custom'} Agreement</div>
              </div>
            </div>

            <ContractMilestonesPanel
              contract={showView}
              isArtist={isArtist}
              busyId={milestoneBusy}
              onPay={handlePayMilestone}
              onApprove={handleApproveMilestone}
            />

            {/* Terms */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Terms & Conditions</h3>
              {showView.attachmentName && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Includes uploaded file: <strong style={{ color: 'var(--text-secondary)' }}>{showView.attachmentName}</strong> — use &quot;Original file&quot; below to download.
                </p>
              )}
              <div style={{
                padding: 20, background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
                fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)',
                maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap'
              }}>
                {showView.terms || STANDARD_TERMS}
              </div>
            </div>

            {/* Signatures */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Signatures</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{
                  padding: 20, borderRadius: 'var(--radius-sm)',
                  border: `2px dashed ${showView.signedByEmployer ? 'var(--success)' : 'var(--border)'}`,
                  background: showView.signedByEmployer ? 'var(--success-muted-bg)' : 'transparent',
                  textAlign: 'center',
                }}>
                  {showView.signedByEmployer ? (
                    <>
                      <CheckCircle size={24} style={{ color: 'var(--success)', marginBottom: 8 }} />
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontStyle: 'italic', color: 'var(--success)', marginBottom: 4 }}>
                        {showView.employerSignature?.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Signed {new Date(showView.employerSignature?.date).toLocaleDateString()}
                      </div>
                    </>
                  ) : (
                    <>
                      <PenTool size={24} style={{ color: 'var(--text-muted)', marginBottom: 8, opacity: 0.5 }} />
                      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Client Signature</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Awaiting</div>
                    </>
                  )}
                </div>
                <div style={{
                  padding: 20, borderRadius: 'var(--radius-sm)',
                  border: `2px dashed ${showView.signedByArtist ? 'var(--success)' : 'var(--border)'}`,
                  background: showView.signedByArtist ? 'var(--success-muted-bg)' : 'transparent',
                  textAlign: 'center',
                }}>
                  {showView.signedByArtist ? (
                    <>
                      <CheckCircle size={24} style={{ color: 'var(--success)', marginBottom: 8 }} />
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontStyle: 'italic', color: 'var(--success)', marginBottom: 4 }}>
                        {showView.artistSignature?.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Signed {new Date(showView.artistSignature?.date).toLocaleDateString()}
                      </div>
                    </>
                  ) : (
                    <>
                      <PenTool size={24} style={{ color: 'var(--text-muted)', marginBottom: 8, opacity: 0.5 }} />
                      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Artist Signature</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Awaiting</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {showView.status === 'pending' && ((!isArtist && !showView.signedByEmployer) || (isArtist && !showView.signedByArtist)) && (
                <button type="button" className="btn btn-success" onClick={() => { setShowView(null); setShowSign(showView) }}>
                  <PenTool size={16} /> Sign Project
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => handleDownloadPDF(showView)}><Download size={16} /> Contract (.txt)</button>
              <button type="button" className="btn btn-secondary" onClick={() => handleDownloadContractInvoice(showView)}><Receipt size={16} /> Statement / invoice (.txt)</button>
              {(showView.hasAttachment || showView.attachmentUrl) && showView.attachmentName && (
                <button type="button" className="btn btn-secondary" onClick={() => handleDownloadAttachment(showView)}>
                  <Download size={16} /> Original file
                </button>
              )}
              {!isArtist && showView.type === 'custom' && isSupabaseConfigured && (
                <>
                  <input ref={reuploadInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={handleReuploadAttachment} />
                  <button type="button" className="btn btn-secondary" onClick={() => reuploadInputRef.current?.click()}>
                    <Upload size={16} /> Replace attachment
                  </button>
                </>
              )}
              {reuploadError && (
                <span style={{ fontSize: 12, color: 'var(--danger)', alignSelf: 'center' }}>{reuploadError}</span>
              )}
              {(showView.status === 'active' || showView.status === 'signed') && (
                <Link to={`/disputes?contract=${showView.id}`} className="btn btn-ghost btn-sm">
                  <Shield size={14} /> Open dispute
                </Link>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setShowView(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== E-Sign Modal ========== */}
      {showSign && (
        <div className="modal-overlay" onClick={() => setShowSign(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sign Project</h2>
              <button className="btn-icon" onClick={() => setShowSign(null)}><X size={18} /></button>
            </div>

            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{showSign.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {isArtist ? `Signing as artist · ${showSign.artistName}` : `Artist: ${showSign.artistName}`}
                {' · '}Value: ${(showSign.value || 0).toLocaleString()} · {showSign.startDate} → {showSign.endDate}
              </div>
            </div>

            {/* Agreement Summary */}
            <div style={{ padding: 16, background: 'var(--accent-tint-05)', border: '1px solid var(--accent-tint-border)', borderRadius: 'var(--radius-sm)', marginBottom: 24, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600 }}>
                <Shield size={16} style={{ color: 'var(--accent)' }} /> By signing, you agree to:
              </div>
              <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <li>The terms and conditions of this {showSign.type} agreement</li>
                <li>Payment of ${(showSign.value || 0).toLocaleString()} according to the milestone schedule</li>
                <li>The cancellation policy and dispute resolution procedures</li>
                <li>This electronic signature is legally binding</li>
              </ul>
            </div>

            {/* Signature Input */}
            <div className="form-group">
              <label className="form-label">Type your full legal name as your signature</label>
              <input
                className="form-input"
                placeholder="Your full name"
                value={signatureName}
                onChange={e => setSignatureName(e.target.value)}
                style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontStyle: 'italic', textAlign: 'center', padding: '16px' }}
              />
            </div>

            {/* Signature Preview */}
            {signatureName && (
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Signature preview</div>
                <div style={{
                  fontFamily: 'Georgia, serif', fontSize: 32, fontStyle: 'italic', color: 'var(--accent)',
                  padding: '16px 32px', borderBottom: '2px solid var(--accent)', display: 'inline-block'
                }}>
                  {signatureName}
                </div>
              </div>
            )}

            {/* Agreement Checkbox */}
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={signatureAgreed}
                onChange={e => setSignatureAgreed(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--accent)' }}
              />
              <span>
                I confirm that I have read and agree to all terms of this contract. I understand that this electronic signature constitutes a legally binding agreement.
              </span>
            </label>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowSign(null)}>Cancel</button>
              <button
                className="btn btn-success btn-lg"
                disabled={!signatureName.trim() || !signatureAgreed}
                onClick={handleSign}
                style={{ opacity: (!signatureName.trim() || !signatureAgreed) ? 0.5 : 1 }}
              >
                <PenTool size={18} /> Sign Project
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <Shield size={12} style={{ marginRight: 4 }} /> Your signature is encrypted and timestamped for legal compliance.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
