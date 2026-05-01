import Stripe from 'stripe'
import { db } from '../_lib/db.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

// Vercel: disable body parsing so we can verify the raw Stripe signature
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
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
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const bookingId =
    event.data.object?.metadata?.bookingId ||
    event.data.object?.payment_intent?.metadata?.bookingId

  if (
    bookingId &&
    (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed')
  ) {
    await db.from('bookings').update({ status: 'paid' }).eq('id', bookingId)
  }

  res.json({ received: true })
}
