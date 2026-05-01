import { db } from '../../_lib/db.js'
import { requireAuth } from '../../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.query
  const { data, error } = await db
    .from('bookings')
    .update({ status: 'paid' })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
}
