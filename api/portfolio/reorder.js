import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { getArtistIdForProfile } from '../_lib/bookings.js'

const ReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const artistId = await getArtistIdForProfile(db, user.id)
  if (!artistId) return res.status(403).json({ error: 'Artist profile required' })

  try {
    const { ids } = ReorderSchema.parse(req.body)

    const { data: existing, error: fetchError } = await db
      .from('portfolio_items')
      .select('id')
      .eq('artist_id', artistId)

    if (fetchError) return res.status(500).json({ error: fetchError.message })

    const owned = new Set((existing || []).map((r) => r.id))
    if (!ids.every((id) => owned.has(id)) || ids.length !== owned.size) {
      return res.status(400).json({ error: 'Invalid portfolio item order' })
    }

    for (let i = 0; i < ids.length; i++) {
      const { error } = await db
        .from('portfolio_items')
        .update({ sort_order: i })
        .eq('id', ids[i])
        .eq('artist_id', artistId)
      if (error) return res.status(500).json({ error: error.message })
    }

    const { data, error } = await db
      .from('portfolio_items')
      .select('*')
      .eq('artist_id', artistId)
      .order('sort_order', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    return res.status(500).json({ error: err.message })
  }
}
