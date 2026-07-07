import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { getArtistIdForProfile } from '../_lib/bookings.js'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Portfolio item id required' })

  const artistId = await getArtistIdForProfile(db, user.id)
  if (!artistId) return res.status(403).json({ error: 'Artist profile required' })

  if (req.method === 'DELETE') {
    const { data: row, error: fetchError } = await db
      .from('portfolio_items')
      .select('id, storage_path')
      .eq('id', id)
      .eq('artist_id', artistId)
      .maybeSingle()

    if (fetchError) return res.status(500).json({ error: fetchError.message })
    if (!row) return res.status(404).json({ error: 'Portfolio item not found' })

    const { error } = await db
      .from('portfolio_items')
      .delete()
      .eq('id', id)
      .eq('artist_id', artistId)

    if (error) return res.status(500).json({ error: error.message })

    if (row.storage_path) {
      await db.storage.from('portfolio-media').remove([row.storage_path]).catch(() => {})
    }

    return res.json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
