import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { rejectIfStripeMissing } from '../../_lib/stripe.js'

/**
 * Legacy direct-pay endpoint — disabled.
 * Hirers must use Stripe Checkout (`/api/payments/create-checkout`).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (rejectIfStripeMissing(res)) return

  return res.status(400).json({
    error:
      'Direct booking pay is disabled. Use Stripe Checkout via /api/payments/create-checkout so funds are collected before marking paid.',
  })
}
