import { getVapidPublicKey, isPushConfigured } from '../_lib/push.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 60, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const publicKey = getVapidPublicKey()
  return res.json({
    configured: isPushConfigured(),
    publicKey,
  })
}
