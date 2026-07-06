import { db } from '../_lib/db.js'
import { validateInviteToken } from '../_lib/validateInvite.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { ok } = rateLimit(getClientIp(req), 60, 60_000)
  if (!ok) {
    return res.status(429).json({ valid: false, reason: 'invalid', error: 'Too many requests' })
  }

  const token = req.query.token
  const result = await validateInviteToken(db, token)
  return res.status(200).json(result)
}
