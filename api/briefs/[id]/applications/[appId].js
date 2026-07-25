import { z } from 'zod'
import { db } from '../../../_lib/db.js'
import { requireAuth } from '../../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../../_lib/ratelimit.js'
import { updateApplicationStatus } from '../../../_lib/briefs.js'
import { createNotification } from '../../../_lib/notifications.js'

const PatchSchema = z.object({
  status: z.enum(['pending', 'shortlisted', 'accepted', 'declined']),
})

const STATUS_MESSAGE = {
  shortlisted: 'You were shortlisted for',
  accepted: 'You were selected for',
  declined: 'Your application was not selected for',
}

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return
  if (!db) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const { id, appId } = req.query
  try {
    const { status } = PatchSchema.parse(req.body || {})
    const result = await updateApplicationStatus(db, id, appId, user.id, status)
    if (result.error === 'not_found') return res.status(404).json({ error: 'Not found' })
    if (result.error === 'forbidden') return res.status(403).json({ error: 'Not your brief' })
    if (result.error === 'bad_status') return res.status(400).json({ error: 'Invalid status' })

    try {
      const note = STATUS_MESSAGE[status]
      const artistProfileId = result.application.artistProfileId
      if (note && artistProfileId) {
        await createNotification(db, {
          userId: artistProfileId,
          type: 'system',
          title: 'Application update',
          body: `${note} "${result.brief.title}"`,
          link: '/briefs',
        })
      }
    } catch (notifyErr) {
      console.error('[briefs] status notify failed:', notifyErr?.message || notifyErr)
    }

    return res.json(result.application)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    return res.status(500).json({ error: err.message })
  }
}
