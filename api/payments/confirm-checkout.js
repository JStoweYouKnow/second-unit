import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { db } from '../_lib/db.js'
import { confirmCheckoutSession } from '../_lib/confirmCheckout.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const sessionId = req.body?.sessionId
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' })
  }

  try {
    const result = await confirmCheckoutSession(db, sessionId, user.id)
    return res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[confirm-checkout]', err?.message || err)
    const msg = err.message || 'Failed to confirm checkout'
    const status = /authorized|not found|required/i.test(msg) ? 400 : 500
    return res.status(status).json({ error: msg })
  }
}
