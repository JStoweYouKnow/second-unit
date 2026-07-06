import { platformFeeAmountCents, artistPayoutAmountCents } from './fees.js'

/**
 * Mark a booking paid and record a payment row (idempotent).
 * Stores the 15/85 fee split and artist Stripe account for later payout release.
 * Used by Stripe webhooks and mock checkout.
 */
export async function completeBookingPayment(db, bookingId, { paymentIntentId = null } = {}) {
  if (!db || !bookingId) {
    return { error: 'Database or booking id missing' }
  }

  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchError) return { error: fetchError.message }
  if (!booking) return { error: 'Booking not found' }

  if (booking.status === 'paid') {
    return { booking, payment: null, alreadyPaid: true }
  }

  // Look up artist's connected Stripe account for the deferred payout
  const { data: artist } = await db
    .from('artists')
    .select('stripe_account_id')
    .eq('id', booking.artist_id)
    .maybeSingle()

  const amountCents = Math.round(Number(booking.agreed_total ?? booking.rate ?? 0) * 100)
  const description = `${booking.booking_type} · ${booking.date}`

  const { error: bookingError } = await db
    .from('bookings')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (bookingError) return { error: bookingError.message }

  const { data: existing } = await db
    .from('payments')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('status', 'paid')
    .maybeSingle()

  if (existing) {
    return { booking: { ...booking, status: 'paid' }, payment: existing, alreadyPaid: true }
  }

  const { data: payment, error: paymentError } = await db
    .from('payments')
    .insert({
      booking_id: bookingId,
      employer_id: booking.employer_id,
      artist_id: booking.artist_id,
      amount: amountCents,
      description,
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      paid_at: new Date().toISOString(),
      artist_stripe_account_id: artist?.stripe_account_id ?? null,
      platform_fee_amount: platformFeeAmountCents(amountCents),
      artist_payout_amount: artistPayoutAmountCents(amountCents),
      payout_status: 'pending',
    })
    .select()
    .single()

  if (paymentError) return { error: paymentError.message }

  return { booking: { ...booking, status: 'paid' }, payment, alreadyPaid: false }
}
