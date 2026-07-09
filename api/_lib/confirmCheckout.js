import { stripe } from './stripe.js'
import { completeMilestonePayment } from './milestones.js'
import { completeBookingPayment } from './completeBookingPayment.js'

/**
 * After Stripe Checkout redirects back, confirm the session and record the payment.
 * Idempotent — safe if the webhook already processed the same payment.
 */
export async function confirmCheckoutSession(db, sessionId, userId) {
  if (!db) throw new Error('Database not configured')
  if (!sessionId) throw new Error('Checkout session id required')
  if (!stripe) throw new Error('Stripe is not configured')

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (!session) throw new Error('Checkout session not found')

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    throw new Error('Checkout is not paid yet')
  }

  const meta = session.metadata || {}
  const milestoneId = meta.milestoneId || null
  const bookingId = meta.bookingId || null
  const contractId = meta.contractId || null

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null

  if (milestoneId) {
    const { getMilestoneWithContract } = await import('./milestones.js')
    const { contract } = await getMilestoneWithContract(db, milestoneId)
    if (contract.employer_id !== userId) {
      throw new Error('Not authorized to confirm this payment')
    }
    const result = await completeMilestonePayment(db, milestoneId, { paymentIntentId })
    if (result.error) throw new Error(result.error)
    return {
      type: 'milestone',
      contractId: contractId || contract.id,
      milestoneId,
      milestone: result.milestone,
      alreadyPaid: !!result.alreadyPaid,
    }
  }

  if (bookingId) {
    const { data: booking } = await db
      .from('bookings')
      .select('employer_id')
      .eq('id', bookingId)
      .maybeSingle()
    if (!booking) throw new Error('Booking not found')
    if (booking.employer_id !== userId) {
      throw new Error('Not authorized to confirm this payment')
    }
    const result = await completeBookingPayment(db, bookingId, { paymentIntentId })
    if (result.error) throw new Error(result.error)
    return {
      type: 'booking',
      bookingId,
      alreadyPaid: !!result.alreadyPaid,
    }
  }

  throw new Error('Checkout session is missing booking or milestone metadata')
}
