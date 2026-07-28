import { stripe, rejectIfStripeMissing } from '../_lib/stripe.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { db } from '../_lib/db.js'
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

  // A PaymentIntent carries `bookingId` metadata that the webhook trusts to mark a
  // booking paid, so both the booking ownership and the amount must be proven here.
  // Neither is ever taken from the request body.
  const { bookingId, description } = req.body || {}

  try {
    const { booking, amountDollars } = await resolveBookingCharge(db, bookingId, user.id)

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amountDollars * 100),
      currency: 'usd',
      metadata: {
        bookingId: String(booking.id),
        description: String(description || '').slice(0, 500),
        escrow: '1',
      },
    })
    res.json({ clientSecret: intent.client_secret })
  } catch (err) {
    if (err instanceof BookingCheckoutError) {
      return res.status(err.status).json({ error: err.message })
    }
    captureException(err, { route: 'payments/create-intent', bookingId })
    res.status(500).json({ error: 'Could not start payment' })
  }
}
