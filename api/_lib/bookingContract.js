import { mapContractToClient } from './contracts.js'
import { mapBookingToClient } from './bookings.js'
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

function estimateDurationFromContract(contract) {
  const start = contract.start_date ? String(contract.start_date).slice(0, 10) : null
  const end = contract.end_date ? String(contract.end_date).slice(0, 10) : null
  if (!start || !end || end === start) {
    return { durationHours: 1, durationUnit: 'project' }
  }
  const ms = new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)
  const days = Math.max(1, Math.round(ms / 86400000) + 1)
  if (days <= 1) return { durationHours: 1, durationUnit: 'project' }
  return { durationHours: days, durationUnit: 'days' }
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

/**
 * When a client creates a project directly, create a linked pending booking for the artist (idempotent).
 * Artist still confirms the booking; both parties still sign the agreement.
 */
export async function ensureBookingForContract(db, contractRow) {
  if (!db || !contractRow?.id) return null

  if (contractRow.booking_id) {
    const { data } = await db
      .from('bookings')
      .select('*')
      .eq('id', contractRow.booking_id)
      .maybeSingle()
    return data ? mapBookingToClient(data) : null
  }

  // Prefer lookup by contract_id when the column exists.
  const { data: byContract, error: byContractError } = await db
    .from('bookings')
    .select('*')
    .eq('contract_id', contractRow.id)
    .maybeSingle()

  if (!byContractError && byContract) {
    await db
      .from('contracts')
      .update({ booking_id: byContract.id, updated_at: new Date().toISOString() })
      .eq('id', contractRow.id)
    return mapBookingToClient(byContract)
  }

  const { data: artist } = await db
    .from('artists')
    .select('id, display_name, profile_id')
    .eq('id', contractRow.artist_id)
    .maybeSingle()

  const artistName =
    contractRow.artist?.display_name ||
    artist?.display_name ||
    'Artist'

  const startDate = contractRow.start_date
    ? String(contractRow.start_date).slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const { durationHours, durationUnit } = estimateDurationFromContract(contractRow)
  const agreedTotal = Math.max(Math.round(Number(contractRow.total_value) || 0), 1)
  const rate = Math.max(Math.round(agreedTotal / Math.max(durationHours, 1)), 1)
  const notes = `Created from project: ${contractRow.title}`

  const bookingInsert = {
    employer_id: contractRow.employer_id,
    artist_id: contractRow.artist_id,
    artist_name: artistName,
    date: startDate,
    start_time: '09:00',
    duration_hours: durationHours,
    duration_unit: durationUnit,
    booking_type: 'Project Work',
    rate,
    agreed_total: agreedTotal,
    status: 'pending',
    notes,
    contract_id: contractRow.id,
  }

  let { data: booking, error } = await db.from('bookings').insert(bookingInsert).select().single()

  // Older DBs may lack optional booking columns — strip and retry.
  if (error && /agreed_total|duration_unit|artist_name|contract_id|column .* does not exist|Could not find the .* column/i.test(error.message || '')) {
    const legacy = {
      employer_id: bookingInsert.employer_id,
      artist_id: bookingInsert.artist_id,
      date: bookingInsert.date,
      start_time: bookingInsert.start_time,
      duration_hours: bookingInsert.duration_hours,
      booking_type: bookingInsert.booking_type,
      rate: bookingInsert.rate,
      status: 'pending',
      notes,
    }
    ;({ data: booking, error } = await db.from('bookings').insert(legacy).select().single())
  }

  if (error) throw error

  // Link contract → booking (ignore if booking_id column missing).
  const { error: linkError } = await db
    .from('contracts')
    .update({ booking_id: booking.id, updated_at: new Date().toISOString() })
    .eq('id', contractRow.id)

  if (linkError && !/booking_id|column .* does not exist|Could not find the .* column/i.test(linkError.message || '')) {
    console.error('[bookingContract] link contract→booking failed:', linkError.message)
  }

  return mapBookingToClient(booking)
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
