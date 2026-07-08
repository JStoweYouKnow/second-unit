import { stripe, FRONTEND_URL } from '../_lib/stripe.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { db } from '../_lib/db.js'
import { completeBookingPayment } from '../_lib/completeBookingPayment.js'
import { createProjectCheckoutSession } from '../_lib/checkout.js'

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
    let artistStripeAccountId = null
    if (bookingId && db) {
      const { data: bookingRow } = await db
        .from('bookings')
        .select('artist_id')
        .eq('id', bookingId)
        .maybeSingle()

      if (bookingRow?.artist_id) {
        const { data: artistRow } = await db
          .from('artists')
          .select('stripe_account_id')
          .eq('id', bookingRow.artist_id)
          .maybeSingle()
        artistStripeAccountId = artistRow?.stripe_account_id ?? null
      }
    }

    const session = await createProjectCheckoutSession(stripe, {
      amountDollars: amount,
      productName: description || `Booking with ${artistName}`,
      productDescription: `Project payment — 15% platform fee deducted at checkout`,
      successUrl: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${bookingId || ''}`,
      cancelUrl: `${FRONTEND_URL}/bookings?payment_cancelled=1`,
      metadata: { bookingId: bookingId || '' },
      artistStripeAccountId,
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
