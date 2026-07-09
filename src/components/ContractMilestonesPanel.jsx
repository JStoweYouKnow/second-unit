import { useRef, useState } from 'react'
import {
  CreditCard,
  CheckCircle,
  Clock,
  Loader2,
  Shield,
  Upload,
  Send,
  ExternalLink,
  Download,
  FileText,
} from './icons'
import {
  canPayMilestone,
  milestoneStatusLabel,
  milestoneStatusColor,
} from '../lib/milestones'
import { PLATFORM_FEE_PERCENT } from '../lib/fees'
import {
  uploadMilestoneDeliverable,
  downloadMilestoneDeliverable,
} from '../lib/milestoneDeliverables'
import { isSupabaseConfigured } from '../lib/supabase'

export function ContractMilestonesPanel({
  contract,
  isArtist,
  onPay,
  onApprove,
  onSubmitDeliverable,
  onRequestRelease,
  busyId = null,
  payments = [],
}) {
  const milestones = contract?.milestones || []
  if (!milestones.length) {
    if (contract?.status === 'active' || contract?.status === 'completed') {
      return (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Milestone schedule loading…
        </p>
      )
    }
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Milestone payments unlock once both parties sign the contract.
      </p>
    )
  }

  const releasedCount = milestones.filter((m) => m.status === 'released').length
  const progress = Math.round((releasedCount / milestones.length) * 100)

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: 0, color: 'var(--text-secondary)' }}>Payment milestones</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{releasedCount}/{milestones.length} released</span>
      </div>

      <div style={{ height: 4, background: 'var(--border)', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--success)', transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {milestones.map((m) => {
          const payment = payments.find((p) => p.milestoneId === m.id)
          const needsTransferRetry =
            m.status === 'released' &&
            payment?.status === 'paid' &&
            !payment?.transferId &&
            payment?.payoutStatus !== 'refunded'
          return (
            <MilestoneRow
              key={m.id}
              contract={contract}
              milestone={m}
              all={milestones}
              isArtist={isArtist}
              busy={busyId === m.id}
              needsTransferRetry={needsTransferRetry}
              onPay={() => onPay?.(contract, m)}
              onApprove={() => onApprove?.(contract, m)}
              onSubmitDeliverable={onSubmitDeliverable}
              onRequestRelease={onRequestRelease}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          {isArtist
            ? 'Clients pay each milestone into escrow. Submit work (optional file or link), then request release — your Stripe payout is sent after the client approves.'
            : `Only your account is charged. Funds are held in escrow until you approve each milestone; the artist then receives ${100 - PLATFORM_FEE_PERCENT}% and The Callsheet retains the ${PLATFORM_FEE_PERCENT}% fee.`}
        </span>
      </div>
    </div>
  )
}

function MilestoneRow({
  contract,
  milestone,
  all,
  isArtist,
  busy,
  onPay,
  onApprove,
  onSubmitDeliverable,
  onRequestRelease,
  needsTransferRetry,
}) {
  const fileRef = useRef(null)
  const [note, setNote] = useState(milestone.deliverableNote || '')
  const [url, setUrl] = useState(milestone.deliverableUrl || '')
  const [pendingFile, setPendingFile] = useState(null)
  const [localBusy, setLocalBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const payReady = !isArtist && canPayMilestone(milestone, all)
  const approveReady =
    !isArtist && (milestone.status === 'funded' || needsTransferRetry)
  const artistCanAct =
    isArtist && (milestone.status === 'funded' || milestone.status === 'awaiting_payment')
  const artistCanRequest = isArtist && milestone.status === 'funded'
  const releaseRequested = !!milestone.releaseRequestedAt
  const statusOpts = { releaseRequested }

  const working = busy || localBusy

  const buildPayload = async () => {
    let storagePath = undefined
    let name = undefined
    let mime = undefined
    if (pendingFile) {
      if (!isSupabaseConfigured) {
        throw new Error('File uploads require Supabase storage')
      }
      storagePath = await uploadMilestoneDeliverable(contract.id, milestone.id, pendingFile)
      name = pendingFile.name
      mime = pendingFile.type || 'application/octet-stream'
    }
    return {
      note: note.trim() || undefined,
      url: url.trim() || undefined,
      storagePath,
      name,
      mime,
    }
  }

  const handleSaveDeliverable = async () => {
    setLocalError('')
    setLocalBusy(true)
    try {
      const payload = await buildPayload()
      if (!payload.note && !payload.url && !payload.storagePath && !milestone.hasDeliverable) {
        throw new Error('Add a note, link, or file before saving')
      }
      await onSubmitDeliverable?.(contract, milestone, payload)
      setPendingFile(null)
      setShowForm(false)
    } catch (err) {
      setLocalError(err.message || 'Could not save deliverable')
    } finally {
      setLocalBusy(false)
    }
  }

  const handleRequestRelease = async () => {
    setLocalError('')
    setLocalBusy(true)
    try {
      // Only include deliverable fields when the form is open or something was entered.
      const hasInput = showForm || note.trim() || url.trim() || pendingFile
      const payload = hasInput ? await buildPayload() : {}
      await onRequestRelease?.(contract, milestone, payload)
      setPendingFile(null)
      setShowForm(false)
    } catch (err) {
      setLocalError(err.message || 'Could not request release')
    } finally {
      setLocalBusy(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 16px',
        border: releaseRequested && milestone.status === 'funded'
          ? '1px solid var(--accent)'
          : '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{milestone.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{milestone.description}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: needsTransferRetry
                ? 'var(--warning, #b45309)'
                : milestoneStatusColor(milestone.status, statusOpts),
            }}
          >
            {milestone.status === 'released' && !needsTransferRetry ? <CheckCircle size={13} /> : <Clock size={13} />}
            {needsTransferRetry
              ? 'Release pending — Stripe transfer not sent'
              : milestoneStatusLabel(milestone.status, statusOpts)}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
            ${milestone.amount.toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {payReady && (
            <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={onPay}>
              {working ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              Pay milestone
            </button>
          )}
          {approveReady && (
            <button type="button" className="btn btn-success btn-sm" disabled={working} onClick={onApprove}>
              {working ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {needsTransferRetry
                ? 'Retry Stripe transfer'
                : releaseRequested
                  ? 'Approve & release'
                  : 'Approve & release'}
            </button>
          )}
          {artistCanAct && !showForm && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={working}
              onClick={() => setShowForm(true)}
            >
              <Upload size={14} />
              {milestone.hasDeliverable ? 'Update deliverable' : 'Add deliverable'}
            </button>
          )}
          {artistCanRequest && !releaseRequested && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={working}
              onClick={handleRequestRelease}
            >
              {working ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Request release
            </button>
          )}
          {artistCanRequest && releaseRequested && (
            <span style={{ fontSize: 12, color: 'var(--accent)', alignSelf: 'center' }}>
              Waiting for client approval
            </span>
          )}
        </div>
      </div>

      {(milestone.hasDeliverable || milestone.deliverableNote || milestone.deliverableUrl || milestone.deliverableName) && (
        <DeliverableSummary milestone={milestone} />
      )}

      {showForm && artistCanAct && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Note (optional)
            <textarea
              className="form-input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What you delivered, revision notes, etc."
              style={{ marginTop: 4, width: '100%', resize: 'vertical' }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Link (optional)
            <input
              className="form-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              style={{ marginTop: 4, width: '100%' }}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={working}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} />
              {pendingFile ? pendingFile.name : 'Attach file (optional)'}
            </button>
            {pendingFile && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingFile(null)}>
                Clear file
              </button>
            )}
          </div>
          {localError && <div className="auth-error" style={{ margin: 0 }}>{localError}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={handleSaveDeliverable}>
              {working ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Save deliverable
            </button>
            {artistCanRequest && (
              <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={handleRequestRelease}>
                {working ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {releaseRequested ? 'Update & keep request' : 'Save & request release'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={working}
              onClick={() => {
                setShowForm(false)
                setLocalError('')
                setPendingFile(null)
              }}
            >
              Cancel
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
            A file or link is optional — you can request release with just a note, or with nothing attached.
          </p>
        </div>
      )}
    </div>
  )
}

function DeliverableSummary({ milestone }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        background: 'var(--bg)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Deliverable</div>
      {milestone.deliverableNote && <div>{milestone.deliverableNote}</div>}
      {milestone.deliverableUrl && (
        <a
          href={milestone.deliverableUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}
        >
          <ExternalLink size={12} />
          {milestone.deliverableUrl}
        </a>
      )}
      {milestone.deliverableStoragePath && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start', padding: '2px 8px' }}
          onClick={() =>
            downloadMilestoneDeliverable(milestone.deliverableStoragePath, milestone.deliverableName)
          }
        >
          <Download size={12} />
          {milestone.deliverableName || 'Download file'}
        </button>
      )}
      {milestone.deliverableSubmittedAt && (
        <div style={{ color: 'var(--text-muted)' }}>
          Submitted {new Date(milestone.deliverableSubmittedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}
