import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { ensureCalendarFeedToken } from '../../_lib/icalFeed.js'
import { FRONTEND_URL } from '../../_lib/stripe.js'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = await ensureCalendarFeedToken(db, user.id)
    const feedUrl = `${FRONTEND_URL}/api/calendar/feed/${token}`
    return res.json({ token, feedUrl })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
