import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { markConversationRead } from '../../_lib/messages.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'

export default async function handler(req, res) {
  // Fires as the user reads threads, so the ceiling is higher than write routes.
  const { ok } = rateLimit(getClientIp(req), 60, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'Conversation id required' })

  if (req.method === 'PATCH') {
    try {
      const conversation = await markConversationRead(db, id, user.id)
      return res.json({ ok: true, conversation })
    } catch (err) {
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
