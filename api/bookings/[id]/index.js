import { z } from 'zod'
import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { mapBookingToClient } from '../../_lib/bookings.js'
import { updatePendingBooking } from '../../_lib/updateBooking.js'

const EditSchema = z.object({
  artistId: z.string().uuid().optional(),
  date: z.string().optional(),
  duration: z.number().positive().optional(),
  durationUnit: z.enum(['hours', 'days', 'project']).optional(),
  type: z.string().optional(),
  agreedTotal: z.number().positive().optional(),
  notes: z.string().optional(),
})

const ERROR_STATUS = {
  not_found: [404, 'Booking not found'],
  forbidden: [403, 'Only the client can edit this booking'],
  not_pending: [400, 'Only pending bookings can be edited'],
  contract_signed: [400, 'This project is already signed — the artist can no longer be changed'],
  artist_not_found: [400, 'Selected artist not found'],
  fee_locked_by_contract: [400, 'The fee is set by the linked project contract and cannot be changed here'],
  invalid_fee: [400, 'Enter a valid fee (whole dollars)'],
}

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  try {
    const patch = EditSchema.parse(req.body || {})
    const result = await updatePendingBooking(db, { id, userId: user.id, patch })
    if (result.error) {
      const [status, message] = ERROR_STATUS[result.error] || [400, result.error]
      return res.status(status).json({ error: message })
    }
    return res.json(mapBookingToClient(result.booking))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    return res.status(500).json({ error: err.message })
  }
}
