import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  getDisputeById,
  addDisputeEvidence,
  updateDisputeStatus,
} from '../_lib/disputes.js'

const EvidenceSchema = z.object({
  note: z.string().max(5000).optional().nullable(),
  fileName: z.string().optional().nullable(),
  storagePath: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
})

const StatusSchema = z.object({
  status: z.enum(['open', 'under_review', 'mediation', 'resolved', 'closed']),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Dispute id required' })

  if (req.method === 'GET') {
    try {
      const dispute = await getDisputeById(db, id, user.id)
      if (!dispute) return res.status(404).json({ error: 'Dispute not found' })
      return res.json(dispute)
    } catch (err) {
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
    }
  }

  if (req.method === 'PATCH') {
    try {
      if (req.body?.status) {
        const validated = StatusSchema.parse(req.body)
        const updated = await updateDisputeStatus(db, id, user.id, validated)
        return res.json(updated)
      }

      const validated = EvidenceSchema.parse(req.body)
      const evidence = await addDisputeEvidence(db, id, user.id, validated)
      const dispute = await getDisputeById(db, id, user.id)
      return res.json({ evidence, dispute })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
