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

  if (booking.status !== 'paid') {
    return res.status(400).json({ error: 'Booking must be in paid status before it can be completed' })
  }

  const { data: payment, error: paymentFetchError } = await db
    .from('payments')
    .select('*')
    .eq('booking_id', id)
    .eq('status', 'paid')
    .maybeSingle()

  if (paymentFetchError) return res.status(500).json({ error: paymentFetchError.message })
  if (!payment) return res.status(404).json({ error: 'No payment found for this booking' })

  if (payment.payout_status === 'pending') {
    if (stripe && payment.artist_stripe_account_id) {
      const account = await stripe.accounts.retrieve(payment.artist_stripe_account_id).catch(() => null)
      if (!account?.payouts_enabled) {
        return res.status(400).json({
          error: 'Artist has not completed Stripe onboarding and cannot receive payouts yet',
        })
      }

      let transfer
      try {
        transfer = await stripe.transfers.create({
          amount: payment.artist_payout_amount,
          currency: 'usd',
          destination: payment.artist_stripe_account_id,
          transfer_group: id,
          metadata: { bookingId: id },
        })
      } catch (err) {
        return res.status(500).json({ error: err.message })
      }

      const { error: payoutUpdateError } = await db
        .from('payments')
        .update({ payout_status: 'paid', transfer_id: transfer.id })
        .eq('id', payment.id)

      if (payoutUpdateError) return res.status(500).json({ error: payoutUpdateError.message })
    } else {
      const { error: payoutUpdateError } = await db
        .from('payments')
        .update({ payout_status: 'paid' })
        .eq('id', payment.id)

      if (payoutUpdateError) return res.status(500).json({ error: payoutUpdateError.message })
    }
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
