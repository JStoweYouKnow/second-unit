import { stripe } from './stripe.js'
import { artistPayoutAmountCents } from './fees.js'

/**
 * Payments tied to a dispute (milestone, contract milestones, or legacy booking).
 */
export async function findPaymentsForDispute(db, disputeRow) {
  if (disputeRow.milestone_id) {
    const { data } = await db
      .from('payments')
      .select('*')
      .eq('milestone_id', disputeRow.milestone_id)
      .eq('status', 'paid')
    return data || []
  }

  if (disputeRow.contract_id) {
    const { data } = await db
      .from('payments')
      .select('*')
      .eq('contract_id', disputeRow.contract_id)
      .eq('status', 'paid')
      .order('created_at', { ascending: true })
    return data || []
  }

  if (disputeRow.booking_id) {
    const { data } = await db
      .from('payments')
      .select('*')
      .eq('booking_id', disputeRow.booking_id)
      .eq('status', 'paid')
    return data || []
  }

  return []
}

async function markPaymentRefunded(db, paymentId, { refundId, amountCents }) {
  await db
    .from('payments')
    .update({
      payout_status: 'refunded',
      refund_id: refundId ?? null,
      refunded_amount: amountCents ?? null,
    })
    .eq('id', paymentId)
}

/** Fail closed — never persist "released" without a real Stripe transfer id. */
export function assertReleaseHasTransferId(transferId) {
  if (!transferId || typeof transferId !== 'string') {
    throw new Error('Cannot mark payment released without a Stripe transfer_id')
  }
}

async function markPaymentReleased(db, paymentId, transferId) {
  assertReleaseHasTransferId(transferId)
  await db
    .from('payments')
    .update({
      payout_status: 'paid',
      transfer_id: transferId,
    })
    .eq('id', paymentId)
}

async function cancelMilestoneForPayment(db, payment) {
  if (!payment.milestone_id) return
  await db
    .from('contract_milestones')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', payment.milestone_id)
    .in('status', ['funded', 'awaiting_payment'])
}

async function stripeRefund(payment, amountCents) {
  if (!stripe || !payment.stripe_payment_intent_id) {
    return { skipped: true, reason: 'no_stripe_payment_intent' }
  }
  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    ...(amountCents != null ? { amount: amountCents } : {}),
  })
  return { refundId: refund.id, amountCents: amountCents ?? payment.amount }
}

async function stripeTransfer(payment, amountCents) {
  if (payment.payout_status === 'paid' && payment.transfer_id) {
    return { skipped: true, reason: 'already_released' }
  }
  const transferAmount = amountCents ?? payment.artist_payout_amount
  if (!transferAmount || transferAmount <= 0) {
    return { skipped: true, reason: 'zero_transfer' }
  }
  if (!stripe || !payment.artist_stripe_account_id) {
    return { skipped: true, reason: 'no_stripe_connect' }
  }

  const { createArtistTransfer } = await import('./artistTransfer.js')
  try {
    const transfer = await createArtistTransfer({
      payment: { ...payment, artist_payout_amount: transferAmount },
      destination: payment.artist_stripe_account_id,
      transferGroup: payment.id,
      metadata: { paymentId: payment.id, disputePayout: 'true' },
    })
    return { transferId: transfer.id, amountCents: transferAmount }
  } catch (err) {
    if (/not completed Stripe onboarding/i.test(err.message)) {
      return { skipped: true, reason: 'artist_not_onboarded' }
    }
    throw err
  }
}

/**
 * Execute Stripe actions for a resolved dispute outcome.
 */
export async function executeDisputePayouts(db, disputeRow, { outcome, splitEmployerCents, splitArtistCents }) {
  if (outcome === 'no_action') {
    return { payoutStatus: 'skipped', actions: [], errors: [] }
  }

  const payments = await findPaymentsForDispute(db, disputeRow)
  if (!payments.length) {
    return { payoutStatus: 'skipped', actions: [], errors: ['No paid payments found for this dispute'] }
  }

  const actions = []
  const errors = []

  if (outcome === 'refund_employer') {
    for (const payment of payments) {
      if (payment.payout_status === 'refunded') continue
      if (payment.payout_status === 'paid') {
        errors.push(`Payment ${payment.id} already released to artist — manual clawback may be required`)
        continue
      }
      try {
        const result = await stripeRefund(payment)
        if (result.skipped) {
          errors.push(`Payment ${payment.id}: ${result.reason}`)
          await markPaymentRefunded(db, payment.id, { refundId: null, amountCents: payment.amount })
        } else {
          await markPaymentRefunded(db, payment.id, {
            refundId: result.refundId,
            amountCents: result.amountCents,
          })
          actions.push({ paymentId: payment.id, type: 'refund', refundId: result.refundId })
        }
        await cancelMilestoneForPayment(db, payment)
      } catch (err) {
        errors.push(`Refund failed for ${payment.id}: ${err.message}`)
      }
    }
  }

  if (outcome === 'release_artist') {
    for (const payment of payments) {
      if (payment.payout_status === 'paid' || payment.payout_status === 'refunded') continue
      try {
        const result = await stripeTransfer(payment)
        if (result.skipped) {
          // Never mark released without a real Stripe transfer_id.
          errors.push(`Payment ${payment.id}: ${result.reason}`)
        } else {
          await markPaymentReleased(db, payment.id, result.transferId)
          actions.push({ paymentId: payment.id, type: 'transfer', transferId: result.transferId })
        }
      } catch (err) {
        errors.push(`Transfer failed for ${payment.id}: ${err.message}`)
      }
    }
  }

  if (outcome === 'split') {
    const employerCents = Math.max(0, Math.round(Number(splitEmployerCents) || 0))
    const artistCents = Math.max(0, Math.round(Number(splitArtistCents) || 0))
    const payment = payments[payments.length - 1]
    const maxArtist = payment.artist_payout_amount ?? artistPayoutAmountCents(payment.amount)

    if (employerCents + artistCents > payment.amount) {
      throw new Error('Split amounts cannot exceed the payment total')
    }
    if (artistCents > maxArtist) {
      throw new Error(`Artist portion cannot exceed ${maxArtist} cents (85% of payment)`)
    }

    try {
      if (employerCents > 0) {
        const refund = await stripeRefund(payment, employerCents)
        if (!refund.skipped) {
          actions.push({ paymentId: payment.id, type: 'partial_refund', refundId: refund.refundId, amountCents: employerCents })
        } else {
          errors.push(`Partial refund: ${refund.reason}`)
        }
      }
      let artistTransferred = false
      if (artistCents > 0 && payment.payout_status !== 'paid') {
        const transfer = await stripeTransfer(payment, artistCents)
        if (!transfer.skipped) {
          await markPaymentReleased(db, payment.id, transfer.transferId)
          actions.push({ paymentId: payment.id, type: 'partial_transfer', transferId: transfer.transferId, amountCents: artistCents })
          artistTransferred = true
        } else {
          errors.push(`Partial transfer: ${transfer.reason}`)
        }
      }
      if (employerCents > 0) {
        await db
          .from('payments')
          .update({
            refunded_amount: employerCents,
            // Only mark paid when a real transfer happened; otherwise refunded/pending.
            payout_status: artistTransferred ? 'paid' : 'refunded',
          })
          .eq('id', payment.id)
      }
    } catch (err) {
      errors.push(err.message)
    }
  }

  const payoutStatus = errors.length && !actions.length ? 'failed' : errors.length ? 'partial' : 'executed'
  return { payoutStatus, actions, errors }
}
