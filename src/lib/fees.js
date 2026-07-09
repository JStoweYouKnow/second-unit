/** Canonical platform fee — keep in sync with api/_lib/fees.js */
export const PLATFORM_FEE_RATE = 0.15
export const ARTIST_PAYOUT_RATE = 0.85
export const PLATFORM_FEE_PERCENT = 15

export function platformFeeAmount(amountDollars) {
  return Math.round(Number(amountDollars) * PLATFORM_FEE_RATE)
}

export function artistPayoutAmount(amountDollars) {
  return Math.round(Number(amountDollars) * ARTIST_PAYOUT_RATE)
}

export function platformFeeAmountCents(amountCents) {
  return Math.round(Number(amountCents) * PLATFORM_FEE_RATE)
}

export function artistPayoutAmountCents(amountCents) {
  return Math.round(Number(amountCents) * ARTIST_PAYOUT_RATE)
}

/** Artist-facing earnings for a payment row (uses stored payout when available). */
export function artistEarningsAmount(payment) {
  if (payment?.artistPayout != null) return payment.artistPayout
  return artistPayoutAmount(payment?.amount ?? 0)
}

/** Amount already released to the artist (Stripe transfer completed). */
export function artistReleasedAmount(payment) {
  if (payment?.status !== 'paid') return 0
  if (payment?.payoutStatus && payment.payoutStatus !== 'paid') return 0
  // Legacy rows without payoutStatus: treat paid status as released.
  if (payment?.payoutStatus == null) return artistEarningsAmount(payment)
  return artistEarningsAmount(payment)
}

/** Amount funded by the hirer but still held in escrow for the artist. */
export function artistEscrowAmount(payment) {
  if (payment?.status !== 'paid') return 0
  if (payment?.payoutStatus === 'paid' || payment?.payoutStatus === 'refunded') return 0
  if (payment?.payoutStatus == null) return 0
  return artistEarningsAmount(payment)
}

/** Role-aware amount for lists, stats, and receipts — hirers see gross; artists see earnings only. */
export function paymentDisplayAmount(payment, isArtist) {
  if (isArtist) return artistEarningsAmount(payment)
  return payment?.amount ?? 0
}
