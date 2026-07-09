import { stripe } from '../../_lib/stripe.js'
import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { mapBookingToClient } from '../../_lib/bookings.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query

  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  if (booking.employer_id !== user.id) {
    return res.status(403).json({ error: 'Only the hirer can complete this booking' })
  }

  const { data: payment, error: paymentFetchError } = await db
    .from('payments')
    .select('*')
    .eq('booking_id', id)
    .eq('status', 'paid')
    .maybeSingle()

  if (paymentFetchError) return res.status(500).json({ error: paymentFetchError.message })

  const needsTransfer =
    !!payment &&
    (payment.payout_status === 'pending' ||
      (payment.payout_status === 'paid' && !payment.transfer_id))

  // Allow retrying a missing Stripe transfer even if the booking was already marked completed.
  if (booking.status === 'completed' && !needsTransfer) {
    return res.json(mapBookingToClient(booking))
  }

  if (booking.status !== 'paid' && booking.status !== 'completed') {
    return res.status(400).json({ error: 'Booking must be in paid status before it can be completed' })
  }

  if (!payment) {
    return res.status(404).json({ error: 'No payment found for this booking' })
  }

  if (needsTransfer) {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured — cannot transfer artist payout' })
    }

    let destination = payment.artist_stripe_account_id
    if (!destination) {
      const { data: artist } = await db
        .from('artists')
        .select('stripe_account_id')
        .eq('id', booking.artist_id)
        .maybeSingle()
      destination = artist?.stripe_account_id || null
      if (destination) {
        await db
          .from('payments')
          .update({ artist_stripe_account_id: destination })
          .eq('id', payment.id)
      }
    }

    if (!destination) {
      return res.status(400).json({
        error:
          'Artist has no Stripe Connect account yet. Have the artist finish Connect onboarding, then complete again.',
      })
    }

    const account = await stripe.accounts.retrieve(destination).catch(() => null)
    if (!account?.payouts_enabled) {
      return res.status(400).json({
        error: 'Artist has not completed Stripe onboarding and cannot receive payouts yet',
      })
    }

    const transferAmount = Number(payment.artist_payout_amount)
    if (!Number.isFinite(transferAmount) || transferAmount < 1) {
      return res.status(400).json({ error: 'Invalid artist payout amount for transfer' })
    }

    let transfer
    try {
      transfer = await stripe.transfers.create({
        amount: transferAmount,
        currency: 'usd',
        destination,
        transfer_group: id,
        metadata: { bookingId: id, paymentId: payment.id },
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }

    const { error: payoutUpdateError } = await db
      .from('payments')
      .update({
        payout_status: 'paid',
        transfer_id: transfer.id,
        artist_stripe_account_id: destination,
      })
      .eq('id', payment.id)

    if (payoutUpdateError) return res.status(500).json({ error: payoutUpdateError.message })
  }

  const { data: updatedBooking, error: updateError } = await db
    .from('bookings')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return res.status(500).json({ error: updateError.message })
  return res.json(mapBookingToClient(updatedBooking))
}
