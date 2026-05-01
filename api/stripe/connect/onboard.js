import { stripe, FRONTEND_URL } from '../../_lib/stripe.js'
import { requireAuth } from '../../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })

  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const { accountId } = req.body
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${FRONTEND_URL}/payments?stripe_refresh=1`,
      return_url: `${FRONTEND_URL}/payments?stripe_success=1`,
      type: 'account_onboarding',
    })
    res.json({ url: accountLink.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
