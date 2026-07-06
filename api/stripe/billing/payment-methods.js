import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { stripe, FRONTEND_URL } from '../../_lib/stripe.js'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!stripe || !db) {
    return res.status(503).json({ error: 'Stripe billing is not configured' })
  }

  if (req.method !== 'GET') {
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

    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    const cards = methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'card',
      last4: pm.card?.last4 || '****',
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    }))

    return res.json({ customerId, paymentMethods: cards })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
