import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { createDispute, listDisputesForUser } from '../_lib/disputes.js'
import { createNotification } from '../_lib/notifications.js'

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(100),
  description: z.string().min(10).max(5000),
  bookingId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      const disputes = await listDisputesForUser(db, user.id)
      return res.json(disputes)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const validated = CreateSchema.parse(req.body)
      if (!validated.bookingId && !validated.contractId) {
        return res.status(400).json({ error: 'bookingId or contractId required' })
      }

      const dispute = await createDispute(db, user.id, validated)

      if (dispute.respondentId) {
        await createNotification(db, {
          userId: dispute.respondentId,
          type: 'system',
          title: 'Dispute opened against your project',
          body: dispute.title,
          link: `/disputes?id=${dispute.id}`,
        })
      }

      const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin')
      for (const admin of admins || []) {
        await createNotification(db, {
          userId: admin.id,
          type: 'system',
          title: 'New dispute requires review',
          body: dispute.title,
          link: `/admin/disputes?id=${dispute.id}`,
        })
      }

      return res.status(201).json(dispute)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
