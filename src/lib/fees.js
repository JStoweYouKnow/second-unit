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
