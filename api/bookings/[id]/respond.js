import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'
import { mapBookingToClient, getArtistIdForProfile } from '../../_lib/bookings.js'
import { ensureContractForBooking } from '../../_lib/bookingContract.js'
import { notifyBookingConfirmed } from '../../_lib/notificationEvents.js'
import { syncBookingToConnectedCalendars } from '../../_lib/googleCalendar.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { id } = req.query
  const { action } = req.body

  if (!['confirm', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'action must be "confirm" or "decline"' })
  }

  const { data: booking, error: fetchError } = await db
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  const artistId = await getArtistIdForProfile(db, user.id)
  const isArtist = artistId != null && booking.artist_id === artistId

  if (!isArtist) {
    return res.status(403).json({ error: 'Only the artist can confirm or decline this booking' })
  }

  if (booking.status !== 'pending') {
    return res.status(400).json({ error: 'Booking is no longer pending' })
  }

  const { data, error } = await db
    .from('bookings')
    .update({
      status: action === 'confirm' ? 'confirmed' : 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  if (action === 'confirm') {
    await ensureContractForBooking(db, data)

    const { data: artistRow } = await db
      .from('artists')
      .select('profile_id')
      .eq('id', data.artist_id)
      .maybeSingle()

    await notifyBookingConfirmed(db, {
      booking: data,
      employerId: data.employer_id,
      artistProfileId: artistRow?.profile_id ?? null,
    })

    await syncBookingToConnectedCalendars(db, id)

    const { data: refreshed, error: refreshError } = await db
      .from('bookings')
      .select(`
        *,
        contract:contracts(
          id,
          title,
          status,
          signed_by_employer,
          signed_by_artist
        )
      `)
      .eq('id', id)
      .single()
    if (!refreshError && refreshed) {
      return res.json(mapBookingToClient(refreshed))
    }
  }

  return res.json(mapBookingToClient(data))
}
