import { stripe, FRONTEND_URL } from '../_lib/stripe.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { amount, artistName, description, bookingId, artistStripeAccountId } = req.body

  // Mock mode: skip Stripe, return a success redirect
  if (!stripe) {
    return res.json({
      url: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${bookingId || ''}`,
    })
  }

  try {
    const platformFee = Math.round(amount * 10)
    const paymentIntentData = { metadata: { bookingId: bookingId || '' } }
    if (artistStripeAccountId) {
      paymentIntentData.application_fee_amount = platformFee
      paymentIntentData.transfer_data = { destination: artistStripeAccountId }
    }

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
      payment_intent_data: paymentIntentData,
      metadata: { bookingId: bookingId || '' },
      success_url: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${bookingId || ''}`,
      cancel_url: `${FRONTEND_URL}/bookings?payment_cancelled=1`,
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
