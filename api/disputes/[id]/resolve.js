import { z } from 'zod'
import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { resolveDispute, isAdmin } from '../../_lib/disputes.js'
import { createNotification } from '../../_lib/notifications.js'

const ResolveSchema = z.object({
  outcome: z.enum(['refund_employer', 'release_artist', 'split', 'no_action']),
  resolutionNotes: z.string().min(1).max(5000),
  splitEmployerCents: z.number().int().min(0).optional().nullable(),
  splitArtistCents: z.number().int().min(0).optional().nullable(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Dispute id required' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (!(await isAdmin(db, user.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const validated = ResolveSchema.parse(req.body)
    const dispute = await resolveDispute(db, id, user.id, validated)

    for (const partyId of [dispute.openedBy, dispute.respondentId].filter(Boolean)) {
      await createNotification(db, {
        userId: partyId,
        type: 'system',
        title: 'Dispute resolved',
        body: validated.resolutionNotes.slice(0, 200),
        link: `/disputes?id=${dispute.id}`,
      })
    }

    return res.json(dispute)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    return res.status(500).json({ error: err.message })
  }
}
