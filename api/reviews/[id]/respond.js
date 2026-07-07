import { z } from 'zod'
import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { upsertReviewResponse } from '../../_lib/reviews.js'

const ResponseSchema = z.object({
  response: z.string().min(1).max(2000),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Review id required' })

  try {
    const validated = ResponseSchema.parse(req.body || {})
    const review = await upsertReviewResponse(db, id, user.id, validated.response)
    return res.json(review)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    const status =
      err.message === 'Forbidden' ? 403
        : err.message.includes('required') || err.message.includes('2000') ? 400
          : 500
    return res.status(status).json({ error: err.message })
  }
}
