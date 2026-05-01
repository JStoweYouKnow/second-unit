import { stripe } from '../../_lib/stripe.js'
import { requireAuth } from '../../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })

  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const { email } = req.body
    const account = await stripe.accounts.create({
      type: 'express',
      email: email || user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })
    res.json({ accountId: account.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
