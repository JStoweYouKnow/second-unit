import { stripe, FRONTEND_URL } from '../_lib/stripe.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { db } from '../_lib/db.js'
import { completeBookingPayment } from '../_lib/completeBookingPayment.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { amount, artistName, description, bookingId } = req.body

  if (bookingId && db) {
    const { data: booking } = await db
      .from('bookings')
      .select('employer_id, status')
      .eq('id', bookingId)
      .maybeSingle()

    if (booking && booking.employer_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to pay for this booking' })
    }
  }

  if (!stripe) {
    if (bookingId && db) {
      await completeBookingPayment(db, bookingId, { paymentIntentId: null })
    }
    return res.json({
      url: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${bookingId || ''}`,
    })
  }

  try {
    // Separate charges model: full payment lands on the platform account.
    // The platform keeps its 15% immediately; the artist's 85% is released
    // explicitly when the project is marked complete via POST /bookings/:id/complete.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: description || `Booking with ${artistName}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        metadata: { bookingId: bookingId || '' },
      },
      metadata: { bookingId: bookingId || '' },
      success_url: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${bookingId || ''}`,
      cancel_url: `${FRONTEND_URL}/bookings?payment_cancelled=1`,
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
