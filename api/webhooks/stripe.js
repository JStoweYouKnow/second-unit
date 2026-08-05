import Stripe from 'stripe'
import { db } from '../_lib/db.js'
import { completeBookingPayment } from '../_lib/completeBookingPayment.js'
import { completeMilestonePayment } from '../_lib/milestones.js'
import { claimStripeEvent, releaseStripeEvent } from '../_lib/stripeEvents.js'
import { captureException, initSentry } from '../_lib/sentry.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

export const config = { api: { bodyParser: false } }

function readMetadata(obj) {
  const meta = obj?.metadata || {}
  const piMeta =
    typeof obj?.payment_intent === 'object' && obj?.payment_intent?.metadata
      ? obj.payment_intent.metadata
      : {}
  return { ...piMeta, ...meta }
}

/** Amount Stripe actually captured, in cents, for the events we act on. */
function capturedAmountCents(event, obj) {
  if (event.type === 'checkout.session.completed') {
    return obj.amount_total ?? null
  }
  // payment_intent.succeeded
  return obj.amount_received ?? obj.amount ?? null
}

/**
 * Deliberately not rate limited. Stripe delivers retries and backlog replays in
 * bursts from a small pool of IPs, so an IP bucket here would drop legitimate
 * payment events. The signature check below is the access control.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  await initSentry()
  if (!stripe) return res.status(503).send('Stripe not configured')

  const sig = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return res.status(503).send('Webhook secret not configured')

  let event
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    event = stripe.webhooks.constructEvent(Buffer.concat(chunks), sig, secret)
  } catch (err) {
    captureException(err, { route: 'webhooks/stripe', phase: 'signature' })
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const obj = event.data.object
  const meta = readMetadata(obj)
  const bookingId = meta.bookingId
  const milestoneId = meta.milestoneId

  const paymentIntentId =
    event.type === 'checkout.session.completed'
      ? (typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id)
      : obj.id

  const isPaymentEvent =
    event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed'

  if (!db || !isPaymentEvent || (!milestoneId && !bookingId)) {
    return res.json({ received: true })
  }

  // A Checkout session fires BOTH checkout.session.completed and
  // payment_intent.succeeded, and Stripe retries on non-2xx — so claim the event
  // before doing any work. A losing claim is a duplicate, not a failure.
  const claim = await claimStripeEvent(db, event)
  if (!claim.claimed) {
    return res.json({ received: true, duplicate: true })
  }

  try {
    const captured = capturedAmountCents(event, obj)

    // Always escrow on the platform — artist payouts happen on milestone approval / booking complete.
    const result = milestoneId
      ? await completeMilestonePayment(db, milestoneId, {
          paymentIntentId,
          capturedAmountCents: captured,
        })
      : await completeBookingPayment(db, bookingId, {
          paymentIntentId,
          capturedAmountCents: captured,
        })

    // These helpers report failure by returning { error }, not by throwing.
    // Swallowing it would strand a captured payment with no record and no retry.
    if (result?.error) {
      throw new Error(result.error)
    }

    return res.json({ received: true })
  } catch (err) {
    // Let Stripe retry: release the claim so the retry can do the work.
    await releaseStripeEvent(db, event.id)
    captureException(err, { route: 'webhooks/stripe', bookingId, milestoneId, type: event.type })
    console.error('[webhooks/stripe]', event.type, err?.message || err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
