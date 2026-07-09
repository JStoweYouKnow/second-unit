import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  ensureAdminArtistPersona,
  mapArtistPersonaToClient,
} from '../_lib/adminArtistPersona.js'

/**
 * POST /api/admin/ensure-artist-persona
 * Provisions (or returns) an artists row for the signed-in admin so they can
 * test Connect + payouts under View as Artist.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) return res.status(500).json({ error: profileError.message })
    if (!profile) return res.status(404).json({ error: 'Profile not found' })

    const { artist, created } = await ensureAdminArtistPersona(db, profile)
    return res.json({
      created,
      artist: mapArtistPersonaToClient(artist),
    })
  } catch (err) {
    console.error('[admin/ensure-artist-persona]', err?.message || err)
    return res.status(err.status || 500).json({ error: err.message || 'Failed to ensure artist persona' })
  }
}
