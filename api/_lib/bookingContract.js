import { mapContractToClient } from './contracts.js'
import { buildAgreementTerms } from './agreementTemplate.js'

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function estimateEndDate(booking) {
  const start = typeof booking.date === 'string' ? booking.date.slice(0, 10) : booking.date
  const unit = booking.duration_unit || 'hours'
  const dur = Number(booking.duration_hours) || 1
  if (unit === 'project') return addDays(start, 30)
  if (unit === 'days') return addDays(start, Math.max(dur, 1))
  if (dur <= 4) return addDays(start, 7)
  if (dur <= 16) return addDays(start, 14)
  return addDays(start, 30)
}

/**
 * When an artist confirms a booking, create a linked project contract (idempotent).
 */
export async function ensureContractForBooking(db, bookingRow) {
  if (!db || !bookingRow?.id) return null

  if (bookingRow.contract_id) {
    const { data } = await db
      .from('contracts')
      .select(`*, artist:artists(display_name)`)
      .eq('id', bookingRow.contract_id)
      .maybeSingle()
    return data ? mapContractToClient(data) : null
  }

  const { data: byBooking } = await db
    .from('contracts')
    .select(`*, artist:artists(display_name)`)
    .eq('booking_id', bookingRow.id)
    .maybeSingle()

  if (byBooking) {
    await db
      .from('bookings')
      .update({ contract_id: byBooking.id, updated_at: new Date().toISOString() })
      .eq('id', bookingRow.id)
    return mapContractToClient(byBooking)
  }

  const agreedTotal = Math.round(Number(bookingRow.agreed_total ?? bookingRow.rate ?? 0))
  const startDate =
    typeof bookingRow.date === 'string' ? bookingRow.date.slice(0, 10) : bookingRow.date
  const endDate = estimateEndDate(bookingRow)

  const { data: profile } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', bookingRow.employer_id)
    .maybeSingle()

  const title = `${bookingRow.booking_type || 'Project'} — ${bookingRow.artist_name || 'Artist'}`
  const notes = bookingRow.notes?.trim() || null

  const { data: contract, error } = await db
    .from('contracts')
    .insert({
      employer_id: bookingRow.employer_id,
      artist_id: bookingRow.artist_id,
      booking_id: bookingRow.id,
      title,
      contract_type: 'standard',
      status: 'pending',
      total_value: agreedTotal,
      start_date: startDate,
      end_date: endDate,
      client_name: profile?.full_name ?? null,
      terms: buildAgreementTerms({ bookingNotes: notes }),
    })
    .select(`*, artist:artists(display_name)`)
    .single()

  if (error) throw error

  await db
    .from('bookings')
    .update({ contract_id: contract.id, updated_at: new Date().toISOString() })
    .eq('id', bookingRow.id)

  return mapContractToClient(contract)
}

export async function syncBookingStatusFromContract(db, contractId) {
  if (!db || !contractId) return

  const { data: contract } = await db
    .from('contracts')
    .select('id, booking_id, status')
    .eq('id', contractId)
    .maybeSingle()

  if (!contract?.booking_id) return

  if (contract.status === 'completed') {
    await db
      .from('bookings')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', contract.booking_id)
  }
}

export async function markBookingPaidFromMilestone(db, contractId) {
  if (!db || !contractId) return

  const { data: contract } = await db
    .from('contracts')
    .select('booking_id')
    .eq('id', contractId)
    .maybeSingle()

  if (!contract?.booking_id) return

  const { data: booking } = await db
    .from('bookings')
    .select('status')
    .eq('id', contract.booking_id)
    .maybeSingle()

  if (booking && booking.status === 'confirmed') {
    await db
      .from('bookings')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', contract.booking_id)
  }
}
