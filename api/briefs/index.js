import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { listOpenBriefs, listMyBriefs, createBrief } from '../_lib/briefs.js'

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().default(''),
  budgetMin: z.number().int().nonnegative().nullable().optional(),
  budgetMax: z.number().int().nonnegative().nullable().optional(),
  timeline: z.string().max(200).optional(),
  location: z.string().max(120).optional(),
  skills: z.array(z.string().max(60)).max(20).optional(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      const mine = req.query?.mine === '1' || req.query?.mine === 'true'
      const briefs = mine
        ? await listMyBriefs(db, user.id)
        : await listOpenBriefs(db, user.id)
      return res.json(briefs)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const validated = CreateSchema.parse(req.body || {})
      const brief = await createBrief(db, user.id, validated)
      return res.status(201).json(brief)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
