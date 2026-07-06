import { format, parse } from 'date-fns'

/** Standard bookable hours shown in the calendar UI */
export const STANDARD_SLOT_LABELS = [
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
]

const LABEL_ORDER = new Map(STANDARD_SLOT_LABELS.map((l, i) => [l, i]))

export function sortSlotLabels(slots) {
  return [...slots].sort((a, b) => (LABEL_ORDER.get(a) ?? 99) - (LABEL_ORDER.get(b) ?? 99))
}

export function formatTime12h(timeValue) {
  if (!timeValue) return ''
  const raw = String(timeValue).slice(0, 5)
  const parsed = parse(raw, 'HH:mm', new Date())
  return format(parsed, 'h:mm a')
}

export function labelToStartTime(label) {
  const parsed = parse(label, 'h:mm a', new Date())
  return format(parsed, 'HH:mm:ss')
}

export function labelToEndTime(label) {
  const parsed = parse(label, 'h:mm a', new Date())
  parsed.setHours(parsed.getHours() + 1)
  return format(parsed, 'HH:mm:ss')
}

export function normalizeDateKey(dateValue) {
  if (!dateValue) return ''
  if (typeof dateValue === 'string') return dateValue.slice(0, 10)
  return format(dateValue, 'yyyy-MM-dd')
}

/**
 * Group DB availability_slots rows into calendar-friendly { date, slots, bookedSlots, rows }.
 */
export function groupSlotsByDate(rows) {
  const map = new Map()

  for (const row of rows || []) {
    const dateStr = normalizeDateKey(row.date)
    if (!dateStr) continue

    if (!map.has(dateStr)) {
      map.set(dateStr, { date: dateStr, slots: [], bookedSlots: [], rows: [] })
    }

    const entry = map.get(dateStr)
    const label = formatTime12h(row.start_time)
    if (label && !entry.slots.includes(label)) {
      entry.slots.push(label)
    }
    if (row.is_booked && label && !entry.bookedSlots.includes(label)) {
      entry.bookedSlots.push(label)
    }
    entry.rows.push(row)
  }

  return Array.from(map.values()).map((entry) => ({
    date: entry.date,
    slots: sortSlotLabels(entry.slots),
    bookedSlots: sortSlotLabels(entry.bookedSlots),
    rows: entry.rows,
  }))
}

/**
 * Normalize artist.availability whether it's grouped UI data or raw DB rows.
 */
export function normalizeArtistAvailability(raw) {
  if (!raw?.length) return []
  if (raw[0].slots) {
    return raw.map((entry) => ({
      ...entry,
      slots: sortSlotLabels(entry.slots || []),
      bookedSlots: sortSlotLabels(entry.bookedSlots || []),
    }))
  }
  return groupSlotsByDate(raw)
}

export function isPastDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}
