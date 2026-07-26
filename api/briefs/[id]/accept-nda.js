import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { getBriefRow } from '../../_lib/briefs.js'
import { recordBriefNdaAcceptance } from '../../_lib/confidentiality.js'

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return
  if (!db) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  try {
    const brief = await getBriefRow(db, id)
    if (!brief) return res.status(404).json({ error: 'Brief not found' })
    if (!brief.nda_storage_path) {
      return res.status(400).json({ error: 'This brief has no NDA to accept' })
    }

    const result = await recordBriefNdaAcceptance(db, id, user.id)
    if (result.error === 'not_artist') {
      return res.status(403).json({ error: 'Only artists can accept brief NDAs' })
    }

    return res.json({ acceptedAt: result.acceptedAt })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
