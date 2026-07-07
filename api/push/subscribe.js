import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { savePushSubscription, removePushSubscription } from '../_lib/push.js'
import { updateNotificationPrefs } from '../_lib/notifications.js'

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'POST') {
    try {
      const validated = SubscriptionSchema.parse(req.body || {})
      const userAgent = req.headers['user-agent'] || null
      await savePushSubscription(db, user.id, validated, userAgent)
      const prefs = await updateNotificationPrefs(db, user.id, { push: true })
      return res.status(201).json({ ok: true, prefs })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : null
      await removePushSubscription(db, user.id, endpoint)
      const prefs = await updateNotificationPrefs(db, user.id, { push: false })
      return res.json({ ok: true, prefs })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
