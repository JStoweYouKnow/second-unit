import { getOpenSlotsForDate } from './availability.js'

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
