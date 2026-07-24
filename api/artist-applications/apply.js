import { z } from 'zod'
import { db } from '../_lib/db.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { applyWithArtistInvite } from '../_lib/inviteApply.js'

const ApplySchema = z.object({
  inviteToken: z.string().min(10),
  email: z.string().email(),
  password: z.string().min(8),
  form: z.object({
    fullName: z.string().min(1),
    roleTitle: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    hourlyRate: z.union([z.string(), z.number()]).optional(),
    dailyRate: z.union([z.string(), z.number()]).optional(),
    projectFlatRate: z.union([z.string(), z.number()]).optional(),
    skills: z.string().optional(),
    brands: z.string().optional(),
    website: z.string().optional(),
    twitter: z.string().optional(),
    instagram: z.string().optional(),
    linkedin: z.string().optional(),
    videoLinks: z.string().optional(),
  }),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { ok } = rateLimit(getClientIp(req), 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests. Try again shortly.' })

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const body = ApplySchema.parse(req.body || {})
    const result = await applyWithArtistInvite(db, {
      inviteToken: body.inviteToken,
      email: body.email,
      password: body.password,
      form: body.form,
    })
    return res.status(200).json({
      ok: true,
      ...result,
      message:
        'Application submitted. Sign in with your email and password to check status.',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues?.[0]
      return res.status(400).json({
        error: first ? `${first.path?.join('.')}: ${first.message}` : 'Invalid request',
      })
    }
    const msg = err.message || 'Application failed'
    const status = /invite|reserved|expired|already used|approved/i.test(msg) ? 400 : 500
    console.error('[artist-applications/apply]', msg)
    return res.status(status).json({ error: msg })
  }
}
