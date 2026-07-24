import { db, dbUsesServiceRole } from './_lib/db.js'
import { stripe, STRIPE_MODE } from './_lib/stripe.js'
import { allowMockPayments, isVercelProduction } from './_lib/env.js'

export default function handler(_req, res) {
  const mockPayments = allowMockPayments()
  const readyForMoney = !!stripe && !!db && dbUsesServiceRole && !mockPayments

  res.json({
    status: readyForMoney || (!isVercelProduction() && !!db) ? 'ok' : 'degraded',
    stripe: !!stripe,
    stripeMode: STRIPE_MODE,
    supabase: !!db,
    serviceRole: dbUsesServiceRole,
    mockPayments,
    production: isVercelProduction(),
    readyForMoney,
  })
}
