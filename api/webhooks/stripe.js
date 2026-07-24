import Stripe from 'stripe'
import { db } from '../_lib/db.js'
import { completeBookingPayment } from '../_lib/completeBookingPayment.js'
import { completeMilestonePayment } from '../_lib/milestones.js'
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

  try {
    if (
      db &&
      (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed')
    ) {
      // Always escrow on the platform — artist payouts happen on milestone approval / booking complete.
      if (milestoneId) {
        await completeMilestonePayment(db, milestoneId, { paymentIntentId })
      } else if (bookingId) {
        await completeBookingPayment(db, bookingId, { paymentIntentId })
      }
    }
  } catch (err) {
    captureException(err, { route: 'webhooks/stripe', bookingId, milestoneId, type: event.type })
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  res.json({ received: true })
}
