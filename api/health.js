import { db } from './_lib/db.js'
import { stripe } from './_lib/stripe.js'

export default function handler(_req, res) {
  res.json({
    status: 'ok',
    stripe: !!stripe,
    supabase: !!db,
    mode: stripe ? 'live' : 'mock',
  })
}
