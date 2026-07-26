import { z } from 'zod'
import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { applyToBrief } from '../../_lib/briefs.js'
import { createNotification } from '../../_lib/notifications.js'

const ApplySchema = z.object({
  message: z.string().max(2000).optional().default(''),
  proposedRate: z.number().int().nonnegative().nullable().optional(),
  ndaAccepted: z.boolean().optional().default(false),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return
  if (!db) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  try {
    const validated = ApplySchema.parse(req.body || {})
    const result = await applyToBrief(db, id, user.id, validated)
    if (result.error === 'not_artist') return res.status(403).json({ error: 'Only artists can apply' })
    if (result.error === 'not_found') return res.status(404).json({ error: 'Brief not found' })
    if (result.error === 'closed') return res.status(400).json({ error: 'This brief is no longer open' })
    if (result.error === 'nda_required') {
      return res.status(400).json({ error: 'You must review and accept the NDA before applying' })
    }

    try {
      const { data: artist } = await db
        .from('artists')
        .select('display_name')
        .eq('id', result.artistId)
        .maybeSingle()
      await createNotification(db, {
        userId: result.brief.employer_id,
        type: 'system',
        title: 'New application',
        body: `${artist?.display_name || 'An artist'} applied to "${result.brief.title}"`,
        link: `/briefs?id=${id}`,
      })
    } catch (notifyErr) {
      console.error('[briefs] apply notify failed:', notifyErr?.message || notifyErr)
    }

    return res.status(201).json(result.application)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    return res.status(500).json({ error: err.message })
  }
}
