import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  listContractsForUser,
  mapContractToDb,
} from '../_lib/contracts.js'
import { linkBookingAfterContractCreate, backfillMissingBookingsForUser } from '../_lib/linkContractBooking.js'

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
  milestoneAmounts: z.array(z.number().int().nonnegative()).length(3).optional(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      await backfillMissingBookingsForUser(db, user.id)
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
      let { data, error } = await db
        .from('contracts')
        .insert(row)
        .select(`*, artist:artists(display_name)`)
        .single()

      // Older DBs may lack milestone_amounts / attachment columns — retry without optional fields.
      if (error && /milestone_amounts|attachment_|client_name|column .* does not exist/i.test(error.message || '')) {
        const {
          milestone_amounts: _m,
          attachment_url: _au,
          attachment_name: _an,
          attachment_mime: _am,
          client_name: _cn,
          ...legacyRow
        } = row
        ;({ data, error } = await db
          .from('contracts')
          .insert(legacyRow)
          .select(`*, artist:artists(display_name)`)
          .single())
      }

      if (error) return res.status(500).json({ error: error.message })
      const linked = await linkBookingAfterContractCreate(db, data)
      return res.status(201).json(linked)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const first = err.issues?.[0] || err.errors?.[0]
        const detail = first ? `${first.path?.join('.') || 'field'}: ${first.message}` : 'Validation failed'
        return res.status(400).json({ error: detail, details: err.issues || err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
