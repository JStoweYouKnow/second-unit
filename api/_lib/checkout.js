import { platformFeeAmountCents, PLATFORM_FEE_PERCENT } from './fees.js'

/**
 * Whether the connected account can receive destination charges + application fees.
 */
export async function canUseDestinationCharge(stripe, accountId) {
  if (!stripe || !accountId) return false
  try {
    const account = await stripe.accounts.retrieve(accountId)
    return Boolean(account.charges_enabled && account.details_submitted)
  } catch {
    return false
  }
}

function toAmountCents(amountDollars) {
  const cents = Math.round(Number(amountDollars) * 100)
  if (!Number.isFinite(cents) || cents < 50) {
    throw new Error('Milestone amount must be at least $0.50 to checkout with Stripe')
  }
  return cents
}

async function createCheckoutSession(stripe, {
  amountCents,
  productName,
  productDescription,
  successUrl,
  cancelUrl,
  metadata,
  artistStripeAccountId,
  useDestination,
}) {
  const paymentIntentData = {
    metadata: { ...metadata, feeAtPayment: useDestination ? '1' : '0' },
  }

  if (useDestination && artistStripeAccountId) {
    paymentIntentData.application_fee_amount = platformFeeAmountCents(amountCents)
    paymentIntentData.transfer_data = { destination: artistStripeAccountId }
  }

  const feeNote = useDestination
    ? ` Includes $${(platformFeeAmountCents(amountCents) / 100).toFixed(2)} platform fee (${PLATFORM_FEE_PERCENT}%) deducted at payment.`
    : ''

  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: String(productName || 'Milestone payment').slice(0, 120),
          description: String((productDescription || '') + feeNote).slice(0, 500) || undefined,
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    payment_intent_data: paymentIntentData,
    metadata: { ...metadata, feeAtPayment: useDestination ? '1' : '0' },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })
}

/**
 * Build Stripe Checkout for project / milestone payment.
 * When the artist has Connect enabled, applies the platform fee at payment
 * via application_fee_amount + transfer_data. Falls back to platform-only
 * checkout if destination charges are unavailable or rejected by Stripe.
 */
export async function createProjectCheckoutSession(stripe, {
  amountDollars,
  productName,
  productDescription,
  successUrl,
  cancelUrl,
  metadata,
  artistStripeAccountId,
}) {
  if (!stripe) throw new Error('Stripe is not configured')
  if (!successUrl || !cancelUrl) throw new Error('Checkout return URLs are required')

  const amountCents = toAmountCents(amountDollars)
  const useDestination = await canUseDestinationCharge(stripe, artistStripeAccountId)

  try {
    return await createCheckoutSession(stripe, {
      amountCents,
      productName,
      productDescription,
      successUrl,
      cancelUrl,
      metadata,
      artistStripeAccountId,
      useDestination,
    })
  } catch (err) {
    // Destination / Connect misconfiguration should not block the hirer from paying.
    if (useDestination) {
      console.error('[checkout] destination charge failed, retrying platform-only:', err?.message || err)
      return createCheckoutSession(stripe, {
        amountCents,
        productName,
        productDescription,
        successUrl,
        cancelUrl,
        metadata,
        artistStripeAccountId: null,
        useDestination: false,
      })
    }
    throw err
  }
}

export async function paymentSplitAtInitiation(stripe, paymentIntentId, metadata = {}) {
  if (metadata.feeAtPayment === '1') return true
  if (!stripe || !paymentIntentId) return false
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    return Boolean(pi.application_fee_amount && pi.transfer_data?.destination)
  } catch {
    return false
  }
}
