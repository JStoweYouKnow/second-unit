import { ensureBookingForContract } from './bookingContract.js'
import { notifyBookingRequested } from './notificationEvents.js'
import { mapContractToClient } from './contracts.js'
import { getArtistIdForProfile } from './bookings.js'

const SKIP_BACKFILL_STATUSES = new Set(['cancelled', 'declined', 'rejected'])

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
    const mapped = refreshed
      ? mapContractToClient(refreshed)
      : mapContractToClient(contractRow)
    return {
      ...mapped,
      bookingId: refreshed?.booking_id || booking.id,
      booking,
    }
  }

  return mapContractToClient(contractRow)
}

/**
 * For projects created before auto-booking: create missing pending bookings.
 * Idempotent — skips contracts that already have booking_id.
 * @returns {{ created: number }}
 */
export async function backfillBookingsForContracts(db, contractRows, { notify = true } = {}) {
  if (!db || !Array.isArray(contractRows) || contractRows.length === 0) {
    return { created: 0 }
  }

  let created = 0

  for (const row of contractRows) {
    if (!row?.id || row.booking_id) continue
    if (SKIP_BACKFILL_STATUSES.has(row.status)) continue

    try {
      const booking = await ensureBookingForContract(db, row)
      if (!booking?.id) continue
      created += 1

      if (notify) {
        try {
          const { data: artistRow } = await db
            .from('artists')
            .select('profile_id')
            .eq('id', row.artist_id)
            .maybeSingle()

          await notifyBookingRequested(db, {
            booking,
            employerId: row.employer_id,
            artistProfileId: artistRow?.profile_id ?? null,
          })
        } catch (notifyErr) {
          console.error('[contracts] backfill notify failed:', notifyErr?.message || notifyErr)
        }
      }
    } catch (err) {
      console.error('[contracts] backfill booking failed:', row.id, err?.message || err)
    }
  }

  return { created }
}

/**
 * Find this user's contracts missing a booking and create them.
 * Safe to call on every contracts/bookings list.
 */
export async function backfillMissingBookingsForUser(db, userId) {
  if (!db || !userId) return { created: 0 }

  const artistId = await getArtistIdForProfile(db, userId)

  let query = db
    .from('contracts')
    .select('*')
    .is('booking_id', null)

  if (artistId) {
    query = query.or(`employer_id.eq.${userId},artist_id.eq.${artistId}`)
  } else {
    query = query.eq('employer_id', userId)
  }

  const { data, error } = await query
  if (error) {
    // Older DBs without booking_id column — nothing to backfill.
    if (/booking_id|column .* does not exist|Could not find the .* column/i.test(error.message || '')) {
      return { created: 0 }
    }
    console.error('[contracts] backfill lookup failed:', error.message)
    return { created: 0 }
  }

  return backfillBookingsForContracts(db, data || [], { notify: true })
}
