import { db } from '../_lib/db.js'
import { buildIcalCalendar, getProfileIdForFeedToken } from '../_lib/icalFeed.js'
import { FRONTEND_URL } from '../_lib/stripe.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!db) {
    return res.status(503).send('Database not configured')
  }

  const { token } = req.query
  if (!token) return res.status(400).send('Feed token required')

  try {
    const profile = await getProfileIdForFeedToken(db, token)
    if (!profile) return res.status(404).send('Feed not found')

    const artistId = await db
      .from('artists')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle()
      .then((r) => r.data?.id ?? null)

    let bookingsQuery = db
      .from('bookings')
      .select('id, date, start_time, end_time, booking_type, status, artist_name')
      .in('status', ['confirmed', 'paid', 'completed'])
      .order('date', { ascending: true })

    if (artistId) {
      bookingsQuery = bookingsQuery.or(`employer_id.eq.${profile.id},artist_id.eq.${artistId}`)
    } else {
      bookingsQuery = bookingsQuery.eq('employer_id', profile.id)
    }

    const { data: bookings } = await bookingsQuery

    const events = (bookings || []).map((b) => ({
      uid: b.id,
      date: String(b.date).slice(0, 10),
      startTime: b.start_time || '09:00:00',
      endTime: b.end_time || '10:00:00',
      summary: `The Callsheet — ${b.booking_type || 'Booking'}`,
      description: `${b.artist_name || 'Artist'} · ${FRONTEND_URL}/bookings`,
    }))

    const ical = buildIcalCalendar({
      name: `The Callsheet — ${profile.full_name || 'Bookings'}`,
      events,
    })

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.status(200).send(ical)
  } catch (err) {
    return res.status(500).send(err.message)
  }
}
