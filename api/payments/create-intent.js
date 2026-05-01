import { stripe } from '../_lib/stripe.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!stripe) return res.json({ clientSecret: `mock_secret_${Date.now()}` })

  try {
    const { amount, artistStripeAccountId, bookingId, description } = req.body
    const intentData = {
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: { bookingId: bookingId || '', description: description || '' },
    }
    if (artistStripeAccountId) {
      intentData.application_fee_amount = Math.round(amount * 10)
      intentData.transfer_data = { destination: artistStripeAccountId }
    }
    const intent = await stripe.paymentIntents.create(intentData)
    res.json({ clientSecret: intent.client_secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
