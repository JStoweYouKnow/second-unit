import { stripe, FRONTEND_URL, rejectIfStripeMissing } from '../_lib/stripe.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { db } from '../_lib/db.js'
import { createProjectCheckoutSession } from '../_lib/checkout.js'
import { resolveBookingCharge, BookingCheckoutError } from '../_lib/bookingCheckout.js'
import { captureException, initSentry } from '../_lib/sentry.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  await initSentry()

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (rejectIfStripeMissing(res)) return

  // `amount` is intentionally NOT read from the body — the booking row is the
  // only source of truth for what the hirer is charged.
  const { artistName, description, bookingId } = req.body || {}

  try {
    // Fails closed on a missing/foreign/already-paid booking.
    const { booking, amountDollars } = await resolveBookingCharge(db, bookingId, user.id)

    let artistStripeAccountId = null
    if (booking.artist_id) {
      const { data: artistRow } = await db
        .from('artists')
        .select('stripe_account_id')
        .eq('id', booking.artist_id)
        .maybeSingle()
      artistStripeAccountId = artistRow?.stripe_account_id ?? null
    }

    const session = await createProjectCheckoutSession(stripe, {
      amountDollars,
      productName: description || `Booking with ${artistName || booking.artist_name || 'artist'}`,
      productDescription: `Project payment held in escrow — artist payout releases after work is approved`,
      successUrl: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${booking.id}`,
      cancelUrl: `${FRONTEND_URL}/bookings?payment_cancelled=1`,
      metadata: { bookingId: String(booking.id) },
      artistStripeAccountId,
    })
    res.json({ url: session.url })
  } catch (err) {
    if (err instanceof BookingCheckoutError) {
      return res.status(err.status).json({ error: err.message })
    }
    captureException(err, { route: 'payments/create-checkout', bookingId })
    res.status(500).json({ error: 'Could not start checkout' })
  }
}
