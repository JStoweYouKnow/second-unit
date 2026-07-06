import crypto from 'node:crypto'
import { FRONTEND_URL } from './stripe.js'
import { ensureCalendarFeedToken } from './icalFeed.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${FRONTEND_URL}/api/calendar/callback`
  return { clientId, clientSecret, redirectUri }
}

export function isGoogleCalendarConfigured() {
  const { clientId, clientSecret } = getGoogleConfig()
  return Boolean(clientId && clientSecret)
}

export async function createOAuthState(db, profileId) {
  const state = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await db.from('calendar_oauth_states').insert({
    state,
    profile_id: profileId,
    expires_at: expiresAt,
  })
  return state
}

export async function consumeOAuthState(db, state) {
  const { data, error } = await db
    .from('calendar_oauth_states')
    .select('*')
    .eq('state', state)
    .maybeSingle()

  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) {
    await db.from('calendar_oauth_states').delete().eq('state', state)
    return null
  }

  await db.from('calendar_oauth_states').delete().eq('state', state)
  return data.profile_id
}

export function buildGoogleAuthUrl(state) {
  const { clientId, redirectUri } = getGoogleConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed: ${text}`)
  }

  return res.json()
}

export async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getGoogleConfig()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token refresh failed: ${text}`)
  }

  return res.json()
}

export async function getValidAccessToken(db, profileId) {
  const { data: conn, error } = await db
    .from('calendar_connections')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) throw error
  if (!conn?.refresh_token) return null

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null
  const stillValid = conn.access_token && expiresAt && expiresAt > new Date(Date.now() + 60_000)

  if (stillValid) {
    return { accessToken: conn.access_token, connection: conn }
  }

  const tokens = await refreshAccessToken(conn.refresh_token)
  const newExpires = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

  const { data: updated, error: updateError } = await db
    .from('calendar_connections')
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpires,
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', profileId)
    .select()
    .single()

  if (updateError) throw updateError
  return { accessToken: tokens.access_token, connection: updated }
}

function bookingToEvent(booking, artistName) {
  const date = String(booking.date).slice(0, 10)
  const time = String(booking.start_time || '09:00').slice(0, 5)
  const start = new Date(`${date}T${time}:00`)
  const durationHours = Number(booking.duration_hours) || 1
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000)

  return {
    summary: `${booking.booking_type || 'Session'} — ${artistName || 'Artist'}`,
    description: `The Callsheet booking #${booking.id}\nAgreed fee: $${booking.agreed_total ?? booking.rate ?? 0}`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
}

export async function upsertBookingCalendarEvent(db, profileId, booking, artistName) {
  const tokenResult = await getValidAccessToken(db, profileId)
  if (!tokenResult) return null

  const { accessToken, connection } = tokenResult
  const calendarId = encodeURIComponent(connection.calendar_id || 'primary')
  const eventMap = connection.event_map || {}
  const mapKey = `booking:${booking.id}`
  const existingEventId = eventMap[mapKey]

  const body = bookingToEvent(booking, artistName)

  let eventId = existingEventId
  if (existingEventId) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(existingEventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )
    if (!res.ok && res.status !== 404) {
      console.error('[calendar] update event failed', await res.text())
    } else if (res.status === 404) {
      eventId = null
    }
  }

  if (!eventId) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )
    if (!res.ok) {
      console.error('[calendar] create event failed', await res.text())
      return null
    }
    const created = await res.json()
    eventId = created.id
  }

  const nextMap = { ...eventMap, [mapKey]: eventId }
  await db
    .from('calendar_connections')
    .update({
      event_map: nextMap,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', profileId)

  return eventId
}

export async function syncBookingToConnectedCalendars(db, bookingId) {
  const { data: booking, error } = await db
    .from('bookings')
    .select(`
      *,
      artist:artists(display_name, profile_id)
    `)
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !booking) return

  const artistName = booking.artist?.display_name || booking.artist_name
  const profileIds = [booking.employer_id, booking.artist?.profile_id].filter(Boolean)

  for (const profileId of profileIds) {
    try {
      await upsertBookingCalendarEvent(db, profileId, booking, artistName)
    } catch (err) {
      console.error(`[calendar] sync booking for ${profileId}:`, err.message)
    }
  }
}

export async function importGoogleBusyBlocks(db, profileId, artistId) {
  const tokenResult = await getValidAccessToken(db, profileId)
  if (!tokenResult) return { imported: 0 }

  const { accessToken, connection } = tokenResult
  const now = new Date()
  const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: connection.calendar_id || 'primary' }],
    }),
  })

  if (!res.ok) {
    console.error('[calendar] freeBusy failed', await res.text())
    return { imported: 0 }
  }

  const data = await res.json()
  const calId = connection.calendar_id || 'primary'
  const busy = data.calendars?.[calId]?.busy || []

  await db.from('google_busy_blocks').delete().eq('profile_id', profileId)
  if (artistId) {
    await db.from('google_busy_blocks').delete().eq('artist_id', artistId)
  }

  const rows = []
  for (const block of busy) {
    const start = new Date(block.start)
    const endDt = new Date(block.end)
    rows.push({
      profile_id: profileId,
      artist_id: artistId ?? null,
      date: start.toISOString().slice(0, 10),
      start_time: start.toISOString().slice(11, 19),
      end_time: endDt.toISOString().slice(11, 19),
      source_event_id: `${block.start}-${block.end}`,
      summary: 'Google Calendar busy',
    })
  }

  if (rows.length) {
    await db.from('google_busy_blocks').insert(rows)
  }

  await db
    .from('calendar_connections')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('profile_id', profileId)

  return { imported: rows.length }
}

export async function getCalendarConnectionStatus(db, profileId) {
  const { data } = await db
    .from('calendar_connections')
    .select('profile_id, calendar_id, sync_enabled, last_synced_at, created_at')
    .eq('profile_id', profileId)
    .maybeSingle()

  let feedUrl = null
  try {
    const token = await ensureCalendarFeedToken(db, profileId)
    feedUrl = `${FRONTEND_URL}/api/calendar/feed/${token}`
  } catch {
    feedUrl = null
  }

  return {
    connected: !!data,
    syncEnabled: data?.sync_enabled ?? false,
    calendarId: data?.calendar_id ?? null,
    lastSyncedAt: data?.last_synced_at ?? null,
    feedUrl,
  }
}

export async function disconnectCalendar(db, profileId) {
  await db.from('calendar_connections').delete().eq('profile_id', profileId)
  await db.from('google_busy_blocks').delete().eq('profile_id', profileId)
  return { ok: true }
}

export async function saveCalendarConnection(db, profileId, tokens) {
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()
  const { data, error } = await db
    .from('calendar_connections')
    .upsert({
      profile_id: profileId,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      token_expires_at: expiresAt,
      calendar_id: 'primary',
      sync_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}
