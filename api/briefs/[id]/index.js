import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import {
  getBriefRow,
  mapBriefToClient,
  listApplicationsForBrief,
  updateBrief,
  getArtistApplicationOnBrief,
} from '../../_lib/briefs.js'

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const brief = await getBriefRow(db, id)
      if (!brief) return res.status(404).json({ error: 'Brief not found' })
      // The owner also gets the applicant list.
      if (brief.employer_id === user.id) {
        const result = await listApplicationsForBrief(db, id, user.id)
        return res.json({ ...result.brief, applications: result.applications })
      }
      const myApplication = await getArtistApplicationOnBrief(db, id, user.id)
      return res.json({
        ...mapBriefToClient(brief, {
          applied: Boolean(myApplication),
          applicationStatus: myApplication?.status,
        }),
        myApplication,
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const result = await updateBrief(db, id, user.id, req.body || {})
      if (result.error === 'not_found') return res.status(404).json({ error: 'Brief not found' })
      if (result.error === 'forbidden') return res.status(403).json({ error: 'Not your brief' })
      return res.json(result.brief)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
