import { PLATFORM_FEE_PERCENT } from './fees.js'

function toAmountCents(amountDollars) {
  const cents = Math.round(Number(amountDollars) * 100)
  if (!Number.isFinite(cents) || cents < 50) {
    throw new Error('Payment amount must be at least $0.50 to checkout with Stripe')
  }
  return cents
}

/**
 * Build Stripe Checkout that charges the hirer on the platform account only.
 * Artist Connect accounts are never charged and never receive funds at checkout —
 * payouts are transferred later when a milestone is approved (or a booking is completed).
 */
export async function createProjectCheckoutSession(stripe, {
  amountDollars,
  productName,
  productDescription,
  successUrl,
  cancelUrl,
  metadata,
  // Kept for call-site compatibility; intentionally unused — no destination charges.
  artistStripeAccountId: _artistStripeAccountId,
}) {
  if (!stripe) throw new Error('Stripe is not configured')
  if (!successUrl || !cancelUrl) throw new Error('Checkout return URLs are required')

  const amountCents = toAmountCents(amountDollars)
  const feeNote = ` ${PLATFORM_FEE_PERCENT}% platform fee is retained by The Callsheet; the artist share is released after milestone approval.`

  // Append Stripe's session id so the app can confirm payment on return
  // even if the webhook is delayed or misconfigured.
  const successWithSession = successUrl.includes('{CHECKOUT_SESSION_ID}')
    ? successUrl
    : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`

  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: String(productName || 'Project payment').slice(0, 120),
          description: String((productDescription || '') + feeNote).slice(0, 500) || undefined,
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    // Platform-only charge: no transfer_data / application_fee_amount.
    // Funds stay on the platform until releaseMilestonePayout / booking complete.
    payment_intent_data: {
      metadata: { ...metadata, feeAtPayment: '0', escrow: '1' },
    },
    metadata: { ...metadata, feeAtPayment: '0', escrow: '1' },
    success_url: successWithSession,
    cancel_url: cancelUrl,
  })
}

/**
 * @deprecated Destination charges are no longer used. Always returns false so
 * artist payouts remain pending until milestone approval / booking completion.
 */
export async function paymentSplitAtInitiation(_stripe, _paymentIntentId, _metadata = {}) {
  return false
}

/** @deprecated Use platform-only checkout; destination charges are disabled. */
export async function canUseDestinationCharge() {
  return false
}
