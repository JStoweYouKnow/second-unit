import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { completeBookingPayment } from '../../_lib/completeBookingPayment.js'
import { mapBookingToClient, userCanAccessBooking } from '../../_lib/bookings.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query

  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  if (booking.employer_id !== user.id) {
    return res.status(403).json({ error: 'Only the hirer can complete payment for this booking' })
  }

  if (booking.status !== 'confirmed') {
    return res.status(400).json({ error: 'Booking must be confirmed before payment' })
  }

  const result = await completeBookingPayment(db, id, { paymentIntentId: null })
  if (result.error) return res.status(500).json({ error: result.error })

  return res.json(mapBookingToClient(result.booking))
}
