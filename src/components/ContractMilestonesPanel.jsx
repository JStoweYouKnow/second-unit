import { useState } from 'react'
import { CreditCard, CheckCircle, Clock, Loader2, Shield } from './icons'
import {
  canPayMilestone,
  milestoneStatusLabel,
  milestoneStatusColor,
} from '../lib/milestones'
import { PLATFORM_FEE_PERCENT } from '../lib/fees'

export function ContractMilestonesPanel({
  contract,
  isArtist,
  onPay,
  onApprove,
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
              milestone={m}
              all={milestones}
              isArtist={isArtist}
              busy={busyId === m.id}
              needsTransferRetry={needsTransferRetry}
              onPay={() => onPay?.(contract, m)}
              onApprove={() => onApprove?.(contract, m)}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          {isArtist
            ? 'Clients pay each milestone into escrow. Your Stripe payout is sent only after the client approves that phase.'
            : `Only your account is charged. Funds are held in escrow until you approve each milestone; the artist then receives ${100 - PLATFORM_FEE_PERCENT}% and The Callsheet retains the ${PLATFORM_FEE_PERCENT}% fee.`}
        </span>
      </div>
    </div>
  )
}

function MilestoneRow({ milestone, all, isArtist, busy, onPay, onApprove, needsTransferRetry }) {
  const payReady = !isArtist && canPayMilestone(milestone, all)
  const approveReady =
    !isArtist && (milestone.status === 'funded' || needsTransferRetry)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{milestone.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{milestone.description}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: needsTransferRetry ? 'var(--warning, #b45309)' : milestoneStatusColor(milestone.status) }}>
          {milestone.status === 'released' && !needsTransferRetry ? <CheckCircle size={13} /> : <Clock size={13} />}
          {needsTransferRetry ? 'Release pending — Stripe transfer not sent' : milestoneStatusLabel(milestone.status)}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
          ${milestone.amount.toLocaleString()}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {payReady && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={onPay}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Pay milestone
          </button>
        )}
        {approveReady && (
          <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={onApprove}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {needsTransferRetry ? 'Retry Stripe transfer' : 'Approve & release'}
          </button>
        )}
      </div>
    </div>
  )
}
