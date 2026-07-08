import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { signContract, updateContractAttachment } from '../_lib/contracts.js'

const SignSchema = z.object({
  name: z.string().min(1),
})

const AttachmentSchema = z.object({
  attachmentStoragePath: z.string().min(1),
  attachmentName: z.string().min(1),
  attachmentMime: z.string().optional().nullable(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Contract id required' })

  if (req.method === 'PATCH') {
    try {
      if (req.body?.attachmentStoragePath) {
        const validated = AttachmentSchema.parse(req.body)
        const updated = await updateContractAttachment(db, id, user.id, {
          attachmentStoragePath: validated.attachmentStoragePath,
          attachmentName: validated.attachmentName,
          attachmentMime: validated.attachmentMime ?? null,
        })
        return res.json(updated)
      }

      const validated = SignSchema.parse(req.body || {})
      const signed = await signContract(db, id, user.id, {
        name: validated.name,
        ip: getClientIp(req),
      })
      return res.json(signed)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const first = err.issues?.[0] || err.errors?.[0]
        const detail = first ? `${first.path?.join('.') || 'field'}: ${first.message}` : 'Validation failed'
        return res.status(400).json({ error: detail, details: err.issues || err.errors })
      }
      return res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
