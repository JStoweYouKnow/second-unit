/** Map DB payment row → client shape used by Payments.jsx */
import { artistPayoutAmountCents } from './fees.js'
import { getArtistIdForProfile } from './bookings.js'

export function mapPaymentToClient(row) {
  if (!row) return null
  const artistName = row.artist?.display_name ?? row.artist_name ?? 'Artist'
  const amountCents = Number(row.amount)
  const artistPayoutCents = row.artist_payout_amount != null
    ? Number(row.artist_payout_amount)
    : artistPayoutAmountCents(amountCents)
  const payoutStatus = row.payout_status || 'pending'
  return {
    id: row.id,
    bookingId: row.booking_id,
    contractId: row.contract_id ?? null,
    milestoneId: row.milestone_id ?? null,
    date: row.paid_at
      ? new Date(row.paid_at).toISOString().slice(0, 10)
      : new Date(row.created_at).toISOString().slice(0, 10),
    status: row.status === 'paid' ? 'paid' : row.status,
    // pending = funded/escrowed; paid = transferred to artist
    payoutStatus,
    amount: Math.round(amountCents / 100),
    artistPayout: Math.round(artistPayoutCents / 100),
    description: row.description || 'Booking payment',
    artistName,
  }
}

export async function listPaymentsForUser(db, userId) {
  const artistId = await getArtistIdForProfile(db, userId)

  let query = db
    .from('payments')
    .select('*, artist:artists(display_name)')
    .order('created_at', { ascending: false })

  if (artistId) {
    query = query.or(`employer_id.eq.${userId},artist_id.eq.${artistId}`)
  } else {
    query = query.eq('employer_id', userId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapPaymentToClient)
}
