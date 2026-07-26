import { addDays, format, parse } from 'date-fns'
import { getOpenSlotsForDate } from './availability.js'

const SCHEDULE_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  paid: 'Paid',
  completed: 'Done',
}

/** YYYY-MM-DD keys a booking occupies (multi-day blocks expand across consecutive days). */
export function bookingDateKeys(booking) {
  const startKey = String(booking?.date || '').slice(0, 10)
  if (!startKey) return []

  const duration = Number(booking?.duration) || 1
  if (booking?.durationUnit !== 'days' || duration <= 1) return [startKey]

  const start = parse(startKey, 'yyyy-MM-dd', new Date())
  const keys = []
  for (let i = 0; i < duration; i++) {
    keys.push(format(addDays(start, i), 'yyyy-MM-dd'))
  }
  return keys
}

export function bookingOccursOnDate(booking, dateKey) {
  return bookingDateKeys(booking).includes(dateKey)
}

/** Derive tile state + caption for an Airbnb-style availability day cell. */
export function getCalendarDayMeta(cell, availability, { editable = false } = {}) {
  const entry = (availability || []).find((a) => a.date === cell.dateKey)
  const openSlots = getOpenSlotsForDate(availability, cell.dateKey)
  const openCount = openSlots.length
  const bookedCount = entry?.bookedSlots?.length || 0
  const hasAny = (entry?.slots?.length || 0) > 0
  const hasOpen = openCount > 0
  const hasBookings = bookedCount > 0
  const hasPartialBooked = hasBookings && hasOpen

  let status = 'empty'
  if (cell.past || cell.hide) status = 'past'
  else if (hasBookings && !hasOpen) status = 'booked-out'
  else if (hasOpen) status = 'available'
  else if (hasAny) status = 'blocked'

  let caption = ''
  if (editable) {
    if (hasOpen) caption = openCount === 1 ? '1 hr open' : `${openCount} hrs open`
    else if (hasBookings) caption = 'Booked'
    else if (hasAny) caption = 'Blocked'
  } else if (hasOpen) {
    caption = openCount === 1 ? '1 hr' : `${openCount} hrs`
  }

  return {
    entry,
    openCount,
    bookedCount,
    hasOpen,
    hasAny,
    hasBookings,
    hasPartialBooked,
    status,
    caption,
    showDogear: hasPartialBooked || hasBookings,
    strikethrough: cell.past || status === 'booked-out' || (editable && status === 'blocked' && !hasOpen),
  }
}

/** Group confirmed/pending bookings by YYYY-MM-DD for calendar chips. */
export function groupBookingsByDate(bookings, artistId) {
  const map = {}
  if (!artistId) return map

  for (const b of bookings || []) {
    if (!b?.date || b.status === 'cancelled' || b.status === 'declined') continue
    if (String(b.artistId) !== String(artistId)) continue
    const key = String(b.date).slice(0, 10)
    if (!map[key]) map[key] = []
    const label = (b.type || 'Booking').trim()
    map[key].push({
      id: b.id,
      name: label,
      avatar: label.charAt(0).toUpperCase(),
    })
  }
  return map
}

/** Group the signed-in user's bookings by date for the schedule calendar. */
export function groupScheduleBookingsByDate(bookings, { isArtist = false } = {}) {
  const map = {}

  for (const b of bookings || []) {
    if (!b?.date || b.status === 'cancelled' || b.status === 'declined') continue

    const typeLabel = (b.type || 'Booking').trim()
    const displayName = isArtist ? typeLabel : (b.artistName || typeLabel)
    const avatar = displayName.charAt(0).toUpperCase()
    const chip = {
      id: b.id,
      name: typeLabel.length > 14 ? `${typeLabel.slice(0, 13)}…` : typeLabel,
      avatar,
      status: b.status,
      statusLabel: SCHEDULE_STATUS_LABELS[b.status] || '',
      booking: b,
    }

    for (const key of bookingDateKeys(b)) {
      if (!map[key]) map[key] = []
      map[key].push(chip)
    }
  }

  return map
}

/** Tile state for schedule / bookings calendar (no availability slots). */
export function getScheduleDayMeta(cell, chips = []) {
  const count = chips.length
  let status = 'empty'

  if (count > 0) {
    const statuses = chips.map((c) => c.status)
    if (statuses.includes('pending')) status = 'pending'
    else if (statuses.includes('confirmed')) status = 'confirmed'
    else status = 'scheduled'
  }

  let caption = ''
  if (count > 1) caption = `${count} bookings`
  else if (count === 1) caption = chips[0].statusLabel || ''

  return {
    status,
    caption,
    hasBookings: count > 0,
    showDogear: count > 0,
    strikethrough: false,
  }
}
