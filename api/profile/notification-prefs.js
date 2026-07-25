import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from '../_lib/notifications.js'
import { normalizePhone } from '../_lib/sms.js'

const PrefsSchema = z.object({
  messages: z.boolean().optional(),
  projects: z.boolean().optional(),
  billing: z.boolean().optional(),
  marketing: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
  phone: z.string().max(32).optional().nullable(),
})

async function getProfilePhone(userId) {
  const { data } = await db
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle()
  return data?.phone ?? null
}

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      const prefs = await getNotificationPrefs(db, user.id)
      const phone = await getProfilePhone(user.id)
      return res.json({ ...prefs, phone })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const validated = PrefsSchema.parse(req.body || {})
      const { phone, ...prefsFields } = validated
      const prefs = await updateNotificationPrefs(db, user.id, prefsFields)

      if (phone !== undefined) {
        const trimmed = phone == null ? '' : String(phone).trim()
        const normalized = trimmed ? normalizePhone(trimmed) : null
        if (trimmed && !normalized) {
          return res.status(400).json({ error: 'Enter a valid mobile number (e.g. +1 555 123 4567)' })
        }
        const { error: phoneError } = await db
          .from('profiles')
          .update({ phone: normalized, updated_at: new Date().toISOString() })
          .eq('id', user.id)
        if (phoneError) throw phoneError
        return res.json({ ...prefs, phone: normalized })
      }

      const storedPhone = await getProfilePhone(user.id)
      return res.json({ ...prefs, phone: storedPhone })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
