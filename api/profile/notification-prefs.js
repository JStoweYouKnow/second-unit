import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from '../_lib/notifications.js'

const PrefsSchema = z.object({
  messages: z.boolean().optional(),
  projects: z.boolean().optional(),
  billing: z.boolean().optional(),
  marketing: z.boolean().optional(),
  push: z.boolean().optional(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      const prefs = await getNotificationPrefs(db, user.id)
      return res.json(prefs)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const validated = PrefsSchema.parse(req.body || {})
      const prefs = await updateNotificationPrefs(db, user.id, validated)
      return res.json(prefs)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
