import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  listBookingsForUser,
  mapBookingToClient,
  mapBookingToDb,
  userCanAccessBooking,
} from '../_lib/bookings.js'
import { notifyBookingRequested } from '../_lib/notificationEvents.js'
import { backfillMissingBookingsForUser } from '../_lib/linkContractBooking.js'

const BookingSchema = z.object({
  artistId: z.string().uuid(),
  artistName: z.string(),
  date: z.string(),
  time: z.string().optional().default('09:00'),
  duration: z.number().positive(),
  durationUnit: z.enum(['hours', 'days', 'project']).optional().default('hours'),
  type: z.string(),
  agreedTotal: z.number().positive(),
  notes: z.string().optional(),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) {
    return res.status(503).json({ error: 'Database not configured' })
  }

  if (req.method === 'GET') {
    try {
      // Older projects may predate auto-booking — create missing pending bookings first.
      await backfillMissingBookingsForUser(db, user.id)
      const bookings = await listBookingsForUser(db, user.id)
      return res.json(bookings)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const validated = BookingSchema.parse(req.body)
      const row = mapBookingToDb(validated, user.id)

      const { data, error } = await db.from('bookings').insert(row).select().single()

      if (error) return res.status(500).json({ error: error.message })
      try {
        const { data: artistRow } = await db
          .from('artists')
          .select('profile_id')
          .eq('id', data.artist_id)
          .maybeSingle()
        await notifyBookingRequested(db, {
          booking: data,
          employerId: data.employer_id,
          artistProfileId: artistRow?.profile_id ?? null,
        })
      } catch (notifyErr) {
        console.error('[bookings] notify requested failed:', notifyErr?.message || notifyErr)
      }
      return res.status(201).json(mapBookingToClient(data))
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
