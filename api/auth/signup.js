import { z } from 'zod'
import { db } from '../_lib/db.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import { signupHirer } from '../_lib/hirerSignup.js'

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['employer']).optional().default('employer'),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { ok } = rateLimit(getClientIp(req), 8, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests. Try again shortly.' })

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const body = SignupSchema.parse(req.body || {})
    if (body.role && body.role !== 'employer') {
      return res.status(400).json({ error: 'Artists must apply via an invite link' })
    }
    const result = await signupHirer(db, {
      email: body.email,
      password: body.password,
      fullName: body.fullName,
    })
    return res.status(200).json({
      ok: true,
      ...result,
      message: 'Account created. You can sign in now.',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues?.[0]
      return res.status(400).json({
        error: first ? `${first.path?.join('.')}: ${first.message}` : 'Invalid request',
      })
    }
    const msg = err.message || 'Sign up failed'
    const status = /already exists|Password|email|name|required/i.test(msg) ? 400 : 500
    console.error('[auth/signup]', msg)
    return res.status(status).json({ error: msg })
  }
}
