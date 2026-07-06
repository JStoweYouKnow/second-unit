/** Map DB payment row → client shape used by Payments.jsx */
import { getArtistIdForProfile } from './bookings.js'

export function mapPaymentToClient(row) {
  if (!row) return null
  const artistName = row.artist?.display_name ?? row.artist_name ?? 'Artist'
  return {
    id: row.id,
    bookingId: row.booking_id,
    date: row.paid_at
      ? new Date(row.paid_at).toISOString().slice(0, 10)
      : new Date(row.created_at).toISOString().slice(0, 10),
    status: row.status === 'paid' ? 'paid' : row.status,
    amount: Math.round(Number(row.amount) / 100),
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
