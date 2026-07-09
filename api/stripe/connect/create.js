import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { db } from '../../_lib/db.js'
import { ensureConnectAccount } from '../../_lib/stripeConnect.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 5, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const { email, artistId } = req.body || {}
    const result = await ensureConnectAccount(db, {
      user,
      email: email || user.email,
      artistId,
    })
    return res.json({ accountId: result.accountId, artistId: result.artistId, reused: result.reused })
  } catch (err) {
    console.error('[stripe/connect/create]', err?.message || err)
    const status = err.status || 500
    return res.status(status).json({ error: err.message || 'Failed to create Connect account' })
  }
}
