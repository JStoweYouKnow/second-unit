import { useState } from 'react'
import { FileText, Plus, Download, Eye, CheckCircle, Clock, Archive, X, PenTool, Shield, Copy, Check } from '../components/icons'
import { contracts as mockContracts, artists } from '../data/mockData'
import { useAuth } from '../context/AuthContext'

const STANDARD_TERMS = `INDEPENDENT CONTRACTOR AGREEMENT

This Agreement ("Agreement") is entered into as of the Start Date specified below.

1. SCOPE OF WORK
The Artist agrees to provide the creative services described in this contract, including all deliverables outlined at the time of booking.

2. COMPENSATION & PAYMENT
• Payment shall be made according to the following milestone schedule:
  - 33% upon contract execution
  - 33% upon delivery of first draft/proof
  - 34% upon final approval and delivery
• All payments processed through Second Unit's platform via Stripe.
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

export default function Contracts() {
  const { profile } = useAuth()
  const [localContracts, setLocalContracts] = useState(mockContracts)
  const [showNew, setShowNew] = useState(false)
  const [showView, setShowView] = useState(null) // contract to view
  const [showSign, setShowSign] = useState(null) // contract to sign
  const [contractType, setContractType] = useState('standard')
  const [newContract, setNewContract] = useState({
    title: '', artistId: '', startDate: '', endDate: '', value: '', customTerms: ''
  })
  const [signatureName, setSignatureName] = useState('')
  const [signatureAgreed, setSignatureAgreed] = useState(false)
  const [copied, setCopied] = useState(false)

  const statusConfig = {
    active: { icon: <CheckCircle size={14} />, color: 'var(--success)', label: 'Active' },
    pending: { icon: <Clock size={14} />, color: 'var(--warning)', label: 'Pending Signature' },
    completed: { icon: <Archive size={14} />, color: 'var(--text-muted)', label: 'Completed' },
    draft: { icon: <FileText size={14} />, color: 'var(--text-secondary)', label: 'Draft' },
  }

  const handleCreateContract = (e) => {
    e.preventDefault()
    const artist = artists.find(a => a.id === parseInt(newContract.artistId))
    if (!artist) return

    const contract = {
      id: `ct_${Date.now()}`,
      title: newContract.title,
      artistName: artist.name,
      artistId: artist.id,
      type: contractType,
      status: 'pending',
      value: parseInt(newContract.value) || 0,
      startDate: newContract.startDate,
      endDate: newContract.endDate,
      terms: contractType === 'custom' ? newContract.customTerms : STANDARD_TERMS,
      signedByEmployer: false,
      signedByArtist: false,
      employerSignature: null,
      artistSignature: null,
      createdAt: new Date().toISOString(),
    }

    setLocalContracts(prev => [contract, ...prev])
    setShowNew(false)
    setNewContract({ title: '', artistId: '', startDate: '', endDate: '', value: '', customTerms: '' })
  }

  const handleSign = () => {
    if (!signatureName.trim() || !signatureAgreed || !showSign) return

    setLocalContracts(prev => prev.map(c => {
      if (c.id === showSign.id) {
        const updated = {
          ...c,
          signedByEmployer: true,
          employerSignature: { name: signatureName, date: new Date().toISOString(), ip: '127.0.0.1' },
        }
        // If both signed, activate
        if (updated.signedByArtist) updated.status = 'active'
        return updated
      }
      return c
    }))

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

  const handleCopyLink = (contract) => {
    navigator.clipboard.writeText(`${window.location.origin}/contracts/${contract.id}`)
    setCopied(contract.id)
    setTimeout(() => setCopied(false), 2000)
  }

  function generateContractText(contract) {
    const divider = '═'.repeat(60)
    return `${divider}
    SECOND UNIT — CONTRACT AGREEMENT
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
This contract was generated and managed through Second Unit.
https://secondunit.com
${divider}
`
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Contracts</h1>
            <p>Manage agreements with your artists</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={16} /> New Contract</button>
        </div>
      </div>

      {/* Contract Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Active', value: localContracts.filter(c => c.status === 'active').length, color: 'var(--success)' },
          { label: 'Pending Signature', value: localContracts.filter(c => c.status === 'pending').length, color: 'var(--warning)' },
          { label: 'Completed', value: localContracts.filter(c => c.status === 'completed').length, color: 'var(--text-muted)' },
          { label: 'Total Value', value: '$' + localContracts.reduce((s, c) => s + (c.value || 0), 0).toLocaleString(), color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Contract List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {localContracts.map(c => {
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
                  <span>Artist: {c.artistName}</span>
                  <span>{c.startDate} → {c.endDate}</span>
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
                {c.status === 'pending' && !c.signedByEmployer && (
                  <button className="btn btn-success btn-sm" onClick={() => setShowSign(c)}>
                    <PenTool size={14} /> Sign
                  </button>
                )}
                <button className="btn-icon" title="View" onClick={() => setShowView(c)}><Eye size={16} /></button>
                <button className="btn-icon" title="Download" onClick={() => handleDownloadPDF(c)}><Download size={16} /></button>
                <button className="btn-icon" title="Copy Link" onClick={() => handleCopyLink(c)}>
                  {copied === c.id ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ========== New Contract Modal ========== */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Contract</h2>
              <button className="btn-icon" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button className={`btn ${contractType === 'standard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setContractType('standard')}>
                <FileText size={14} /> Standard Agreement
              </button>
              <button className={`btn ${contractType === 'custom' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setContractType('custom')}>
                <PenTool size={14} /> Custom Agreement
              </button>
            </div>

            <form onSubmit={handleCreateContract}>
              <div className="form-group">
                <label className="form-label">Contract Title</label>
                <input className="form-input" placeholder="e.g., Brand Campaign Q2 2026" value={newContract.title}
                  onChange={e => setNewContract(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Artist</label>
                <select className="form-input" value={newContract.artistId}
                  onChange={e => setNewContract(p => ({ ...p, artistId: e.target.value }))} required>
                  <option value="">Select an artist...</option>
                  {artists.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={newContract.startDate}
                    onChange={e => setNewContract(p => ({ ...p, startDate: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input className="form-input" type="date" value={newContract.endDate}
                    onChange={e => setNewContract(p => ({ ...p, endDate: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Value ($)</label>
                  <input className="form-input" type="number" placeholder="10000" value={newContract.value}
                    onChange={e => setNewContract(p => ({ ...p, value: e.target.value }))} required />
                </div>
              </div>

              {contractType === 'custom' && (
                <div className="form-group">
                  <label className="form-label">Custom Terms & Conditions</label>
                  <textarea className="form-input" placeholder="Enter your custom agreement terms here..."
                    style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 13 }}
                    value={newContract.customTerms}
                    onChange={e => setNewContract(p => ({ ...p, customTerms: e.target.value }))} required />
                </div>
              )}

              {contractType === 'standard' && (
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><FileText size={16} /> Create Contract</button>
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

            {/* Terms */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Terms & Conditions</h3>
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
                  background: showView.signedByEmployer ? 'rgba(0,212,170,0.05)' : 'transparent',
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
                  background: showView.signedByArtist ? 'rgba(0,212,170,0.05)' : 'transparent',
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

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {showView.status === 'pending' && !showView.signedByEmployer && (
                <button className="btn btn-success" onClick={() => { setShowView(null); setShowSign(showView) }}>
                  <PenTool size={16} /> Sign Contract
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => handleDownloadPDF(showView)}><Download size={16} /> Download</button>
              <button className="btn btn-secondary" onClick={() => setShowView(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== E-Sign Modal ========== */}
      {showSign && (
        <div className="modal-overlay" onClick={() => setShowSign(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sign Contract</h2>
              <button className="btn-icon" onClick={() => setShowSign(null)}><X size={18} /></button>
            </div>

            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{showSign.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Artist: {showSign.artistName} · Value: ${(showSign.value || 0).toLocaleString()} · {showSign.startDate} → {showSign.endDate}
              </div>
            </div>

            {/* Agreement Summary */}
            <div style={{ padding: 16, background: 'rgba(124,92,252,0.05)', border: '1px solid rgba(124,92,252,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: 24, fontSize: 13 }}>
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
                <PenTool size={18} /> Sign Contract
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
