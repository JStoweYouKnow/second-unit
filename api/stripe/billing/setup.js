import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { stripe, FRONTEND_URL } from '../../_lib/stripe.js'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!stripe || !db) {
    return res.status(503).json({ error: 'Stripe billing is not configured' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: profile } = await db
      .from('profiles')
      .select('stripe_customer_id, email, full_name')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || undefined,
        metadata: { profileId: user.id },
      })
      customerId = customer.id
      await db
        .from('profiles')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: `${FRONTEND_URL}/account?billing=success`,
      cancel_url: `${FRONTEND_URL}/account?billing=cancel`,
    })

    return res.json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
