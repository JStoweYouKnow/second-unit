import crypto from 'node:crypto'

function escapeIcal(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatIcalDate(dateStr, timeStr) {
  const d = dateStr || ''
  const t = (timeStr || '09:00:00').slice(0, 8)
  const iso = `${d}T${t}`
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function buildIcalCalendar({ name, events }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Callsheet//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcal(name)}`,
  ]

  for (const ev of events) {
    const start = formatIcalDate(ev.date, ev.startTime)
    const end = formatIcalDate(ev.date, ev.endTime)
    if (!start || !end) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcal(ev.uid)}@thecallsheet.ai`,
      `DTSTAMP:${formatIcalDate(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(11, 19))}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcal(ev.summary)}`,
      ev.description ? `DESCRIPTION:${escapeIcal(ev.description)}` : null,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.filter(Boolean).join('\r\n')
}

export async function ensureCalendarFeedToken(db, profileId) {
  const { data: profile } = await db
    .from('profiles')
    .select('calendar_feed_token')
    .eq('id', profileId)
    .maybeSingle()

  if (profile?.calendar_feed_token) return profile.calendar_feed_token

  const token = crypto.randomUUID().replace(/-/g, '')
  await db
    .from('profiles')
    .update({ calendar_feed_token: token })
    .eq('id', profileId)

  return token
}

export async function getProfileIdForFeedToken(db, token) {
  const { data } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('calendar_feed_token', token)
    .maybeSingle()
  return data
}
