import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { db } from '../../_lib/db.js'
import { createConnectOnboardingLink, resolveArtistForConnect } from '../../_lib/stripeConnect.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  try {
    let { accountId, artistId } = req.body || {}

    // If no accountId, resolve from the signed-in artist's saved Connect id.
    if (!accountId && db) {
      const artist = await resolveArtistForConnect(db, user, artistId)
      accountId = artist?.stripe_account_id || null
    }

    const url = await createConnectOnboardingLink(accountId)
    return res.json({ url })
  } catch (err) {
    console.error('[stripe/connect/onboard]', err?.message || err)
    const status = err.status || 500
    const message = err.message || 'Failed to create Stripe onboarding link'
    // Common platform misconfig
    if (/signed up for Connect|Connect.*not.*enabled|responsible for negative/i.test(message)) {
      return res.status(503).json({
        error:
          'Stripe Connect is not enabled on this Stripe account. Enable Connect in the Stripe Dashboard, then try again.',
      })
    }
    return res.status(status).json({ error: message })
  }
}
