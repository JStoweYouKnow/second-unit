import { stripe } from '../../_lib/stripe.js'
import { requireAuth } from '../../_lib/auth.js'
import { rateLimit, getClientIp } from '../../_lib/ratelimit.js'
import { db } from '../../_lib/db.js'
import { getArtistIdForProfile } from '../../_lib/bookings.js'

function bankLast4FromAccount(account) {
  const ext = account?.external_accounts?.data
  if (!Array.isArray(ext) || ext.length === 0) return null
  const bank = ext.find((e) => e.object === 'bank_account') || ext[0]
  return bank?.last4 ? String(bank.last4) : null
}

function deriveStatus({ accountId, detailsSubmitted, chargesEnabled, payoutsEnabled, currentlyDue }) {
  if (!accountId) return 'not_connected'
  if (payoutsEnabled && detailsSubmitted) return 'ready'
  if (currentlyDue?.length || (!detailsSubmitted && accountId)) return 'incomplete'
  if (!payoutsEnabled) return 'restricted'
  return 'incomplete'
}

/**
 * Live Stripe Connect status for the signed-in artist.
 * GET /api/stripe/connect/status
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { ok } = rateLimit(getClientIp(req), 30, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const artistId = await getArtistIdForProfile(db, user.id)
    if (!artistId) {
      return res.json({
        connected: false,
        accountId: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [],
        bankLast4: null,
        status: 'not_connected',
        message: 'No artist profile linked to this account.',
      })
    }

    const { data: artist, error } = await db
      .from('artists')
      .select('id, stripe_account_id')
      .eq('id', artistId)
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })

    const accountId = artist?.stripe_account_id || null
    if (!accountId) {
      return res.json({
        connected: false,
        accountId: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [],
        bankLast4: null,
        status: 'not_connected',
        message: 'Payout account not connected yet.',
      })
    }

    if (!stripe) {
      return res.json({
        connected: true,
        accountId,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [],
        bankLast4: null,
        status: 'incomplete',
        message: 'Stripe is not configured on the server; cannot verify live status.',
      })
    }

    // Do not expand external_accounts — that requires Full Bank Account Information Read
    // on restricted keys. payouts_enabled / details_submitted are enough for readiness.
    const account = await stripe.accounts.retrieve(accountId)

    const detailsSubmitted = !!account.details_submitted
    const chargesEnabled = !!account.charges_enabled
    const payoutsEnabled = !!account.payouts_enabled
    const currentlyDue = account.requirements?.currently_due || []
    const bankLast4 = bankLast4FromAccount(account)
    const status = deriveStatus({
      accountId,
      detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
      currentlyDue,
    })

    return res.json({
      connected: true,
      accountId,
      detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
      requirementsDue: currentlyDue,
      bankLast4,
      status,
      message:
        status === 'ready'
          ? 'Payouts enabled — earnings can be transferred to your bank.'
          : status === 'restricted'
            ? 'Account connected but payouts are not enabled yet.'
            : 'Finish Stripe onboarding to enable payouts.',
    })
  } catch (err) {
    console.error('[stripe/connect/status]', err?.message || err)
    return res.status(500).json({ error: err.message || 'Failed to load Connect status' })
  }
}
