import { format, parse, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth } from 'date-fns'

/** Generate 24 one-hour slot labels: 12:00 AM … 11:00 PM */
function buildHourLabels() {
  const labels = []
  for (let h = 0; h < 24; h++) {
    labels.push(format(new Date(2000, 0, 1, h, 0, 0), 'h:mm a'))
  }
  return labels
}

/** Standard bookable hours (full day, hour-long segments). */
export const STANDARD_SLOT_LABELS = buildHourLabels()

/** Common presets (subset of STANDARD_SLOT_LABELS). */
export const SLOT_PRESETS = {
  fullDay: STANDARD_SLOT_LABELS,
  business: STANDARD_SLOT_LABELS.filter((l) => {
    const h = parse(l, 'h:mm a', new Date()).getHours()
    return h >= 9 && h <= 17
  }),
  morning: STANDARD_SLOT_LABELS.filter((l) => {
    const h = parse(l, 'h:mm a', new Date()).getHours()
    return h >= 6 && h < 12
  }),
  afternoon: STANDARD_SLOT_LABELS.filter((l) => {
    const h = parse(l, 'h:mm a', new Date()).getHours()
    return h >= 12 && h < 18
  }),
  evening: STANDARD_SLOT_LABELS.filter((l) => {
    const h = parse(l, 'h:mm a', new Date()).getHours()
    return h >= 18
  }),
}

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

export function detectBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function listTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone')
    }
  } catch {
    /* fall through */
  }
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Pacific/Auckland',
  ]
}

function zonedYmdParts(date, timeZone) {
  const tz = timeZone || detectBrowserTimeZone()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  }
}

/** Today's calendar date key (YYYY-MM-DD) in the given IANA timezone. */
export function todayKeyInZone(timeZone) {
  const { year, month, day } = zonedYmdParts(new Date(), timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatTimeZoneLabel(timeZone) {
  if (!timeZone) return ''
  try {
    const nice = timeZone.replace(/_/g, ' ')
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value
    return offset ? `${nice} (${offset})` : nice
  } catch {
    return timeZone
  }
}

/**
 * True if the given Date (local calendar day) is before today in timeZone.
 */
export function isPastDate(date, timeZone) {
  const key = normalizeDateKey(date)
  if (!key) return false
  return key < todayKeyInZone(timeZone)
}

export function isMonthFullyPast(monthDate, timeZone) {
  const endKey = format(endOfMonth(monthDate), 'yyyy-MM-dd')
  return endKey < todayKeyInZone(timeZone)
}

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * A rolling calendar fragment that STARTS at today (no leading blank cells) and
 * runs forward for `weeks` rows of 7 consecutive days. The weekday header labels
 * are rotated so the first column matches today's weekday.
 */
export function buildForwardWeeks(weeks = 6, { timeZone } = {}) {
  const todayKey = todayKeyInZone(timeZone)
  // Local "today" for rendering; date comparisons use the timezone-aware key.
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => WEEKDAY_ABBR[(start.getDay() + i) % 7])

  const rows = []
  let day = start
  for (let w = 0; w < weeks; w++) {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = day
      const dateKey = format(d, 'yyyy-MM-dd')
      days.push({
        date: d,
        dateKey,
        inMonth: true,
        past: dateKey < todayKey,
        hide: false,
        isToday: dateKey === todayKey,
      })
      day = addDays(day, 1)
    }
    rows.push(days)
  }
  return { weekdayLabels, weeks: rows }
}

/**
 * Build month grid weeks. Past days in the current month are placeholders
 * (hidden from booking) so the weekday columns stay aligned.
 */
export function buildMonthWeeks(monthDate, { timeZone, hidePastDays = true } = {}) {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  const todayKey = todayKeyInZone(timeZone)

  const weeks = []
  let day = startDate

  while (day <= endDate) {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = day
      const dateKey = format(d, 'yyyy-MM-dd')
      const inMonth = isSameMonth(d, monthStart)
      const past = hidePastDays && dateKey < todayKey
      const hide = past && inMonth

      days.push({
        date: d,
        dateKey,
        inMonth,
        past,
        hide,
        isToday: dateKey === todayKey,
      })
      day = addDays(day, 1)
    }
    weeks.push(days)
  }

  return weeks
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

/** Open (bookable) hour labels for a date — published slots minus booked. */
export function getOpenSlotsForDate(availability, dateKey) {
  const key = normalizeDateKey(dateKey)
  const entry = (availability || []).find((a) => a.date === key)
  if (!entry) return []
  const booked = new Set(entry.bookedSlots || [])
  return sortSlotLabels((entry.slots || []).filter((label) => !booked.has(label)))
}

export function datesWithOpenSlots(availability) {
  return (availability || [])
    .filter((entry) => getOpenSlotsForDate([entry], entry.date).length > 0)
    .map((entry) => entry.date)
}

/**
 * Inclusive contiguous hour labels between two open slots.
 * Returns null if either endpoint is missing or any hour in between is not open.
 */
export function resolveContiguousHourRange(openLabels, startLabel, endLabel) {
  const open = sortSlotLabels(openLabels || [])
  if (!startLabel || !endLabel) return null
  if (!open.includes(startLabel) || !open.includes(endLabel)) return null

  const a = LABEL_ORDER.get(startLabel)
  const b = LABEL_ORDER.get(endLabel)
  if (a == null || b == null) return null

  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const range = STANDARD_SLOT_LABELS.slice(lo, hi + 1)

  for (const label of range) {
    if (!open.includes(label)) return null
  }

  return {
    slots: range,
    startLabel: STANDARD_SLOT_LABELS[lo],
    endLabel: STANDARD_SLOT_LABELS[hi],
    durationHours: range.length,
  }
}

/**
 * Inclusive date keys from start to end (YYYY-MM-DD). Returns null if invalid.
 */
export function enumerateDateKeys(startKey, endKey) {
  const a = normalizeDateKey(startKey)
  const b = normalizeDateKey(endKey)
  if (!a || !b) return null

  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  let start = new Date(y1, m1 - 1, d1)
  let end = new Date(y2, m2 - 1, d2)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  if (start > end) {
    const tmp = start
    start = end
    end = tmp
  }

  const keys = []
  let cur = start
  while (cur <= end) {
    keys.push(format(cur, 'yyyy-MM-dd'))
    cur = addDays(cur, 1)
  }
  return keys
}

/**
 * Validate a multi-day range: every date must have at least one open slot.
 */
export function resolveDayRange(availability, startKey, endKey) {
  const keys = enumerateDateKeys(startKey, endKey)
  if (!keys?.length) return null

  for (const key of keys) {
    if (getOpenSlotsForDate(availability, key).length === 0) return null
  }

  const firstOpen = getOpenSlotsForDate(availability, keys[0])
  const startLabel = firstOpen[0] || null
  const time = startLabel
    ? String(labelToStartTime(startLabel)).slice(0, 5)
    : '09:00'

  return {
    dateKeys: keys,
    startDate: keys[0],
    endDate: keys[keys.length - 1],
    durationDays: keys.length,
    startLabel,
    time,
  }
}

/** HH:mm for Bookings form from a 12h slot label. */
export function labelToFormTime(label) {
  if (!label) return '09:00'
  return String(labelToStartTime(label)).slice(0, 5)
}

/**
 * Build bookings handoff fields from calendar selection.
 * @returns {{ date: string, time: string, duration: number, durationUnit: 'hours'|'days' } | null}
 */
export function buildBookingPrefillFromSelection(selection) {
  if (!selection) return null
  if (selection.durationUnit === 'hours') {
    const range = selection.hourRange
    if (!range?.durationHours) return null
    return {
      date: selection.date,
      time: labelToFormTime(range.startLabel),
      duration: range.durationHours,
      durationUnit: 'hours',
    }
  }
  if (selection.durationUnit === 'days') {
    const range = selection.dayRange
    if (!range?.durationDays) return null
    return {
      date: range.startDate,
      time: range.time || '09:00',
      duration: range.durationDays,
      durationUnit: 'days',
    }
  }
  return null
}
