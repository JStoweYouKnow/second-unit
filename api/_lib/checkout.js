import { platformFeeAmountCents } from './fees.js'

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

/**
 * Build Stripe Checkout for project initiation.
 * When the artist has Connect enabled, applies the 15% platform fee at payment
 * via application_fee_amount + transfer_data (85% to artist immediately).
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
  const amountCents = Math.round(Number(amountDollars) * 100)
  const useDestination = await canUseDestinationCharge(stripe, artistStripeAccountId)

  const paymentIntentData = { metadata: { ...metadata, feeAtPayment: useDestination ? '1' : '0' } }

  if (useDestination) {
    paymentIntentData.application_fee_amount = platformFeeAmountCents(amountCents)
    paymentIntentData.transfer_data = { destination: artistStripeAccountId }
  }

  const feeNote = useDestination
    ? ` Includes ${Math.round(amountCents * 0.15) / 100} platform fee (15%) deducted at payment.`
    : ''

  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: productName,
          description: (productDescription || '') + feeNote,
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
