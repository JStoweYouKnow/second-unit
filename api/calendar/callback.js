import { db } from '../_lib/db.js'
import {
  consumeOAuthState,
  exchangeCodeForTokens,
  saveCalendarConnection,
  importGoogleBusyBlocks,
} from '../_lib/googleCalendar.js'
import { FRONTEND_URL } from '../_lib/stripe.js'
import { getArtistIdForProfile } from '../_lib/bookings.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!db) {
    return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
  }

  const { code, state, error: oauthError } = req.query

  if (oauthError || !code || !state) {
    return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
  }

  try {
    const profileId = await consumeOAuthState(db, state)
    if (!profileId) {
      return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
    }

    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
    }

    await saveCalendarConnection(db, profileId, tokens)

    const artistId = await getArtistIdForProfile(db, profileId)
    if (artistId) {
      await importGoogleBusyBlocks(db, profileId, artistId)
    }

    return res.redirect(`${FRONTEND_URL}/account?calendar=connected`)
  } catch (err) {
    console.error('[calendar] callback error:', err.message)
    return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
  }
}
