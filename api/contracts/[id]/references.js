import { z } from 'zod'
import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import {
  listProjectReferences,
  addProjectReference,
  deleteProjectReference,
} from '../../_lib/projectReferences.js'

const AddSchema = z.object({
  storagePath: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  mime: z.string().max(120).optional().nullable(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 40, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const result = await listProjectReferences(db, id, user.id)
      if (result.error === 'not_found') return res.status(404).json({ error: 'Project not found' })
      if (result.error === 'forbidden') return res.status(403).json({ error: 'Forbidden' })
      return res.json(result)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const validated = AddSchema.parse(req.body || {})
      const result = await addProjectReference(db, id, user.id, validated)
      if (result.error === 'not_found') return res.status(404).json({ error: 'Project not found' })
      if (result.error === 'forbidden') return res.status(403).json({ error: 'Forbidden' })
      if (result.error === 'invalid') return res.status(400).json({ error: 'Invalid reference payload' })
      return res.status(201).json(result.reference)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'DELETE') {
    const referenceId = req.query.referenceId
    if (!referenceId) return res.status(400).json({ error: 'referenceId required' })
    try {
      const result = await deleteProjectReference(db, id, referenceId, user.id)
      if (result.error === 'not_found') return res.status(404).json({ error: 'Reference not found' })
      if (result.error === 'forbidden') return res.status(403).json({ error: 'Forbidden' })
      return res.json({ ok: true, storagePath: result.storagePath })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
