import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'

const BookingSchema = z.object({
  artistId: z.union([z.string(), z.number()]),
  artistName: z.string(),
  date: z.string(),
  time: z.string().optional().default('09:00'),
  duration: z.number().positive(),
  durationUnit: z.enum(['hours', 'days', 'project']).optional().default('hours'),
  type: z.string(),
  agreedTotal: z.number().positive(),
  notes: z.string().optional(),
})

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const { data, error } = await db.from('bookings').select('*')
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'POST') {
    try {
      const validated = BookingSchema.parse(req.body)
      const booking = {
        ...validated,
        id: `bk_${Date.now()}`,
        employerId: user.id,
        status: 'pending',
        totalAmount: validated.agreedTotal,
        createdAt: new Date().toISOString(),
      }
      const { data, error } = await db.from('bookings').insert([booking]).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data[0])
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
