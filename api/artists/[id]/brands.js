import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { isAdmin } from '../_lib/disputes.js'

const VerifySchema = z.object({
  brandName: z.string().min(1).max(120),
  verified: z.boolean(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const artistId = req.query.id
  if (!artistId) return res.status(400).json({ error: 'Artist id required' })

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  try {
    if (!(await isAdmin(db, user.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const validated = VerifySchema.parse(req.body || {})
    const brandName = validated.brandName.trim()

    const { data: links, error: linkError } = await db
      .from('artist_brands')
      .select('brand_id, brand:brands(name)')
      .eq('artist_id', artistId)

    if (linkError) throw linkError

    const match = (links || []).find(
      (row) => row.brand?.name?.toLowerCase() === brandName.toLowerCase()
    )
    if (!match?.brand_id) {
      return res.status(404).json({ error: 'Brand not linked to this artist' })
    }

    const patch = validated.verified
      ? { verified: true, verified_at: new Date().toISOString(), verified_by: user.id }
      : { verified: false, verified_at: null, verified_by: null }

    const { data, error } = await db
      .from('artist_brands')
      .update(patch)
      .eq('artist_id', artistId)
      .eq('brand_id', match.brand_id)
      .select('verified, brand:brands(name)')
      .single()

    if (error) throw error

    return res.json({
      name: data.brand?.name ?? brandName,
      verified: !!data.verified,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    return res.status(500).json({ error: err.message })
  }
}
