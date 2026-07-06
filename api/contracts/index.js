import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  listContractsForUser,
  mapContractToClient,
  mapContractToDb,
} from '../_lib/contracts.js'

const ContractSchema = z.object({
  title: z.string().min(1),
  artistId: z.string().uuid(),
  type: z.enum(['standard', 'custom']).default('standard'),
  value: z.number().nonnegative(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  terms: z.string().optional(),
  clientName: z.string().optional(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
  attachmentMime: z.string().optional().nullable(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      const contracts = await listContractsForUser(db, user.id)
      return res.json(contracts)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const validated = ContractSchema.parse(req.body)
      const row = mapContractToDb(validated, user.id)
      const { data, error } = await db
        .from('contracts')
        .insert(row)
        .select(`*, artist:artists(display_name)`)
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(mapContractToClient(data))
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
