import { stripe, FRONTEND_URL } from './stripe.js'
import { getArtistIdForProfile } from './bookings.js'

/**
 * Resolve the artists row for Connect onboarding (body artistId or profile link).
 */
export async function resolveArtistForConnect(db, userId, requestedArtistId) {
  if (!db || !userId) return null

  if (requestedArtistId) {
    const { data } = await db
      .from('artists')
      .select('id, profile_id, stripe_account_id, display_name')
      .eq('id', requestedArtistId)
      .maybeSingle()
    if (data && data.profile_id === userId) return data
  }

  const artistId = await getArtistIdForProfile(db, userId)
  if (!artistId) return null

  const { data } = await db
    .from('artists')
    .select('id, profile_id, stripe_account_id, display_name')
    .eq('id', artistId)
    .maybeSingle()
  return data || null
}

/**
 * Create or reuse a Stripe Express account and persist stripe_account_id.
 */
export async function ensureConnectAccount(db, { user, email, artistId }) {
  if (!stripe) {
    const err = new Error('Stripe is not configured on the server (missing STRIPE_SECRET_KEY)')
    err.status = 503
    throw err
  }

  const artist = await resolveArtistForConnect(db, user.id, artistId)
  if (!artist?.id) {
    const err = new Error(
      'No artist profile linked to this account. Complete artist onboarding before connecting payouts.'
    )
    err.status = 400
    throw err
  }

  if (artist.stripe_account_id) {
    try {
      await stripe.accounts.retrieve(artist.stripe_account_id)
      return { accountId: artist.stripe_account_id, artistId: artist.id, reused: true }
    } catch {
      // Stale/deleted account — create a new one below.
    }
  }

  const account = await stripe.accounts.create({
    type: 'express',
    email: email || user.email || undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      product_description: 'Creative services booked via The Callsheet',
    },
    metadata: {
      artist_id: artist.id,
      profile_id: user.id,
    },
  })

  const { error: updateError } = await db
    .from('artists')
    .update({ stripe_account_id: account.id, updated_at: new Date().toISOString() })
    .eq('id', artist.id)

  if (updateError) {
    console.error('[stripe/connect] failed to save account id:', updateError.message)
    const err = new Error(`Stripe account created but could not be saved: ${updateError.message}`)
    err.status = 500
    throw err
  }

  return { accountId: account.id, artistId: artist.id, reused: false }
}

/**
 * Create a Stripe Account Link for Express onboarding.
 */
export async function createConnectOnboardingLink(accountId) {
  if (!stripe) {
    const err = new Error('Stripe is not configured on the server (missing STRIPE_SECRET_KEY)')
    err.status = 503
    throw err
  }
  if (!accountId || typeof accountId !== 'string' || !accountId.startsWith('acct_')) {
    const err = new Error('A valid Stripe Connect account id is required')
    err.status = 400
    throw err
  }
  if (accountId.startsWith('acct_mock_')) {
    const err = new Error('This is a mock Connect account. Connect with a real Stripe key to continue.')
    err.status = 400
    throw err
  }

  const base = FRONTEND_URL || 'https://www.thecallsheet.ai'
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/payments?stripe_refresh=1`,
    return_url: `${base}/payments?stripe_success=1`,
    type: 'account_onboarding',
  })

  if (!accountLink?.url) {
    const err = new Error('Stripe did not return an onboarding URL')
    err.status = 502
    throw err
  }

  return accountLink.url
}
