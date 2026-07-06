import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { getArtistIdForProfile } from '../_lib/bookings.js'

const PortfolioSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  mediaUrl: z.string().url(),
  mediaType: z.enum(['image', 'video']).default('image'),
  storagePath: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
})

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const artistId = await getArtistIdForProfile(db, user.id)
  if (!artistId) return res.status(403).json({ error: 'Artist profile required' })

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('portfolio_items')
      .select('*')
      .eq('artist_id', artistId)
      .order('sort_order', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  if (req.method === 'POST') {
    try {
      const validated = PortfolioSchema.parse(req.body)
      const { data, error } = await db
        .from('portfolio_items')
        .insert({
          artist_id: artistId,
          title: validated.title,
          description: validated.description ?? null,
          media_url: validated.mediaUrl,
          media_type: validated.mediaType,
          storage_path: validated.storagePath ?? null,
          sort_order: validated.sortOrder ?? 0,
        })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
