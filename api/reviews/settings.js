import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { updateArtistReviewSettings } from '../_lib/reviews.js'

const SettingsSchema = z.object({
  showReviewsOnProfile: z.boolean(),
})

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'PATCH') {
    try {
      const validated = SettingsSchema.parse(req.body)
      const settings = await updateArtistReviewSettings(db, user.id, validated)
      return res.json(settings)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
