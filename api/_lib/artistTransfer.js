import { stripe } from './stripe.js'

/**
 * Resolve the Charge id for a PaymentIntent so transfers can use
 * source_transaction and move funds before the platform balance settles.
 */
export async function chargeIdForPaymentIntent(paymentIntentId) {
  if (!stripe || !paymentIntentId) return null

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  const latest = pi.latest_charge
  if (!latest) return null
  return typeof latest === 'string' ? latest : latest.id
}

/**
 * Pure helper for tests / debugging — builds Stripe Transfer create params.
 */
export function buildArtistTransferParams({
  payment,
  destination,
  transferGroup,
  metadata = {},
  chargeId = null,
}) {
  const transferAmount = Number(payment.artist_payout_amount)
  if (!Number.isFinite(transferAmount) || transferAmount < 1) {
    throw new Error('Invalid artist payout amount for transfer')
  }
  if (!destination) {
    throw new Error(
      'Artist has no Stripe Connect account yet. Have the artist finish Connect onboarding, then try again.'
    )
  }

  const params = {
    amount: transferAmount,
    currency: 'usd',
    destination,
    transfer_group: transferGroup ? String(transferGroup) : String(payment.id),
    metadata: {
      paymentId: payment.id,
      ...metadata,
    },
  }
  if (chargeId) params.source_transaction = chargeId
  return params
}

/**
 * Create a Connect transfer for an escrowed payment.
 * Prefers source_transaction (the hirer charge) so release works while
 * funds are still pending on the platform balance.
 */
export async function createArtistTransfer({
  payment,
  destination,
  transferGroup,
  metadata = {},
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured — cannot transfer artist payout')
  }
  if (!destination) {
    throw new Error(
      'Artist has no Stripe Connect account yet. Have the artist finish Connect onboarding, then try again.'
    )
  }

  const account = await stripe.accounts.retrieve(destination).catch(() => null)
  if (!account?.payouts_enabled) {
    throw new Error('Artist has not completed Stripe onboarding and cannot receive payouts yet')
  }

  const chargeId = await chargeIdForPaymentIntent(payment.stripe_payment_intent_id)
  const params = buildArtistTransferParams({
    payment,
    destination,
    transferGroup,
    metadata,
    chargeId,
  })

  try {
    return await stripe.transfers.create(params)
  } catch (err) {
    // If source_transaction was rejected for some reason, retry without it
    // only when the platform has available balance (rare edge case).
    if (chargeId && params.source_transaction) {
      const msg = String(err.message || '')
      if (/source_transaction|already been transferred|insufficient/i.test(msg)) {
        // Re-throw with clearer context for the common pending-balance case
        // when source_transaction somehow isn't usable.
        throw new Error(
          err.message ||
            'Could not transfer from the original charge. Wait for funds to settle, then retry.'
        )
      }
    }
    throw err
  }
}

/**
 * Look up the artist's current Connect account id, preferring the payment snapshot.
 */
export async function resolveArtistDestination(db, payment, artistId) {
  let destination = payment.artist_stripe_account_id || null
  if (destination) return destination

  if (!artistId) return null

  const { data: artist } = await db
    .from('artists')
    .select('stripe_account_id')
    .eq('id', artistId)
    .maybeSingle()

  destination = artist?.stripe_account_id || null
  if (destination) {
    await db
      .from('payments')
      .update({ artist_stripe_account_id: destination })
      .eq('id', payment.id)
  }
  return destination
}
