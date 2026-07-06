import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  isGoogleCalendarConfigured,
  createOAuthState,
  buildGoogleAuthUrl,
} from '../_lib/googleCalendar.js'

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (!isGoogleCalendarConfigured()) {
    return res.status(503).json({ error: 'Google Calendar OAuth is not configured' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const state = await createOAuthState(db, user.id)
    const url = buildGoogleAuthUrl(state)
    return res.json({ url })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
