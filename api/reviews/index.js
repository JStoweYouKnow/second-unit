import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  listReviewsForArtist,
  upsertReview,
  getArtistReviewSettings,
} from '../_lib/reviews.js'

const SubmitSchema = z.object({
  artistId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  hirerName: z.string().optional(),
  company: z.string().optional(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const reviewId = req.query.id
  const artistId = req.query.artistId

  if (req.method === 'GET') {
    if (!artistId) return res.status(400).json({ error: 'artistId required' })
    try {
      const publicOnly = req.query.public === '1'
      const reviews = await listReviewsForArtist(db, artistId, { publicOnly })
      const settings = await getArtistReviewSettings(db, artistId)
      return res.json({ reviews, settings })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST' && !reviewId) {
    try {
      const validated = SubmitSchema.parse(req.body)
      const review = await upsertReview(db, user.id, validated)
      return res.status(201).json(review)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
