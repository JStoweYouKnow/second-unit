import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { listPaymentsForUser } from '../_lib/payments.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 60, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.json([])

  try {
    const payments = await listPaymentsForUser(db, user.id)
    return res.json(payments)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
