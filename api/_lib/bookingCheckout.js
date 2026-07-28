/**
 * Authoritative booking payment amount.
 *
 * The hirer's client must never decide what it is charged. Every booking payment
 * entry point resolves the amount here, from the booking row, so the Stripe charge
 * and the `payments` row written by the webhook always describe the same money.
 */

/** Booking statuses that may still be paid for. */
const PAYABLE_STATUSES = new Set(['pending', 'confirmed'])

export class BookingCheckoutError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'BookingCheckoutError'
    this.status = status
  }
}

/**
 * Derive the charge amount from a booking row.
 *
 * Mirrors src/lib/pricing.js `bookingSubtotal` exactly — agreed_total when set,
 * otherwise rate × duration (rate alone for project blocks, which store
 * duration_hours = 1). Keeping the two in step means the total the hirer sees in
 * the UI is always the total Stripe charges.
 *
 * @returns {number} amount in whole dollars
 */
export function bookingAmountDollars(booking) {
  const agreed = Number(booking?.agreed_total)
  if (Number.isFinite(agreed) && agreed > 0) return Math.round(agreed)

  const rate = Number(booking?.rate) || 0
  const durationHours = Number(booking?.duration_hours) || 0
  const amount =
    booking?.duration_unit === 'project'
      ? Math.round(rate)
      : Math.round(rate * durationHours)

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BookingCheckoutError('Booking has no valid agreed total to charge', 400)
  }
  return amount
}

/**
 * Load a booking, prove the caller is its hirer, and return the amount to charge.
 * Fails closed: a missing booking or a missing db is an error, never a pass-through.
 *
 * @returns {Promise<{ booking: object, amountDollars: number }>}
 */
export async function resolveBookingCharge(db, bookingId, userId) {
  if (!db) throw new BookingCheckoutError('Database not configured', 503)
  if (!bookingId) throw new BookingCheckoutError('Booking id is required', 400)

  const { data: booking, error } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw new BookingCheckoutError(error.message, 500)
  if (!booking) throw new BookingCheckoutError('Booking not found', 404)

  if (booking.employer_id !== userId) {
    throw new BookingCheckoutError('Not authorized to pay for this booking', 403)
  }

  if (booking.status === 'paid' || booking.status === 'completed') {
    throw new BookingCheckoutError('This booking has already been paid', 400)
  }

  if (!PAYABLE_STATUSES.has(booking.status)) {
    throw new BookingCheckoutError(
      `A ${booking.status} booking cannot be paid`,
      400,
    )
  }

  return { booking, amountDollars: bookingAmountDollars(booking) }
}

/**
 * Guard for the webhook / confirm path: the amount Stripe actually captured must
 * match what the booking says it is worth, or the payout math is built on a lie.
 *
 * @param {number} capturedCents  amount_total / amount_received reported by Stripe
 * @param {number} expectedCents  amount derived from the booking row
 */
export function assertCapturedAmountMatches(capturedCents, expectedCents) {
  const captured = Number(capturedCents)
  const expected = Number(expectedCents)

  if (!Number.isFinite(captured) || !Number.isFinite(expected)) {
    throw new BookingCheckoutError('Cannot verify captured payment amount', 500)
  }
  // Exact match: both sides are integer cents derived from the same source.
  if (captured !== expected) {
    throw new BookingCheckoutError(
      `Captured amount ${captured} does not match expected ${expected}`,
      400,
    )
  }
}
