import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { updateReviewVisibility } from '../_lib/reviews.js'

const VisibilitySchema = z.object({
  visible: z.boolean(),
})

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Review id required' })

  if (req.method === 'PATCH') {
    try {
      const validated = VisibilitySchema.parse(req.body)
      const review = await updateReviewVisibility(db, id, user.id, validated.visible)
      return res.json(review)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
