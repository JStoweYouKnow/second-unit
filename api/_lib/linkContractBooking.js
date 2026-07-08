import { ensureBookingForContract } from './bookingContract.js'
import { notifyBookingRequested } from './notificationEvents.js'
import { mapContractToClient } from './contracts.js'

/**
 * After a client creates a project, ensure a pending booking exists for the artist
 * and notify them. Failures are logged but do not fail project creation.
 */
export async function linkBookingAfterContractCreate(db, contractRow) {
  if (!db || !contractRow?.id) return mapContractToClient(contractRow)

  let booking = null
  try {
    booking = await ensureBookingForContract(db, contractRow)
  } catch (err) {
    console.error('[contracts] ensure booking after create failed:', err?.message || err)
    return mapContractToClient(contractRow)
  }

  try {
    const { data: artistRow } = await db
      .from('artists')
      .select('profile_id')
      .eq('id', contractRow.artist_id)
      .maybeSingle()

    await notifyBookingRequested(db, {
      booking: booking || {
        date: contractRow.start_date,
        type: 'Project Work',
        booking_type: 'Project Work',
      },
      employerId: contractRow.employer_id,
      artistProfileId: artistRow?.profile_id ?? null,
    })
  } catch (err) {
    console.error('[contracts] notify booking requested failed:', err?.message || err)
  }

  // Re-fetch so bookingId is present on the returned contract when the link succeeded.
  if (booking?.id) {
    const { data: refreshed } = await db
      .from('contracts')
      .select(`*, artist:artists(display_name)`)
      .eq('id', contractRow.id)
      .maybeSingle()
    if (refreshed) {
      return { ...mapContractToClient(refreshed), bookingId: refreshed.booking_id || booking.id }
    }
    return { ...mapContractToClient(contractRow), bookingId: booking.id }
  }

  return mapContractToClient(contractRow)
}
