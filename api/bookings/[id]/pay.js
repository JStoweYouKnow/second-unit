import { requireAuth } from '../../_lib/auth.js'
import { rejectIfStripeMissing } from '../../_lib/stripe.js'

/**
 * Legacy direct-pay endpoint — disabled.
 * Hirers must use Stripe Checkout (`/api/payments/create-checkout`).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (rejectIfStripeMissing(res)) return

  return res.status(400).json({
    error:
      'Direct booking pay is disabled. Use Stripe Checkout via /api/payments/create-checkout so funds are collected before marking paid.',
  })
}
