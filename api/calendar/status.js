import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import {
  getCalendarConnectionStatus,
  disconnectCalendar,
  importGoogleBusyBlocks,
  syncBookingToConnectedCalendars,
} from '../_lib/googleCalendar.js'
import { getArtistIdForProfile, listBookingsForUser } from '../_lib/bookings.js'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      const status = await getCalendarConnectionStatus(db, user.id)
      return res.json(status)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'DELETE') {
    try {
      await disconnectCalendar(db, user.id)
      return res.json({ ok: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const artistId = await getArtistIdForProfile(db, user.id)
      let imported = 0

      if (artistId) {
        const result = await importGoogleBusyBlocks(db, user.id, artistId)
        imported = result.imported
      }

      const bookings = await listBookingsForUser(db, user.id)
      for (const b of bookings) {
        if (b.status === 'confirmed' || b.status === 'paid') {
          await syncBookingToConnectedCalendars(db, b.id)
        }
      }

      return res.json({ ok: true, importedBusyBlocks: imported })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
