import { stripe, rejectIfStripeMissing } from '../_lib/stripe.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (rejectIfStripeMissing(res)) return

  try {
    const { amount, bookingId, description } = req.body
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'usd',
      metadata: { bookingId: bookingId || '', description: description || '' },
    })
    res.json({ clientSecret: intent.client_secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
