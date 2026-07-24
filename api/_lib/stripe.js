import Stripe from 'stripe'
import { stripeKeyMode } from './env.js'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

export const STRIPE_MODE = stripeKeyMode()

export const FRONTEND_URL = (() => {
  // Prefer explicit production URL for Connect return/refresh links (preview URLs break handoff).
  let url =
    process.env.FRONTEND_URL ||
    process.env.VITE_PRODUCTION_URL ||
    (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:5173'
  if (url && !url.startsWith('http')) url = `https://${url}`
  return url.replace(/\/$/, '')
})()

/**
 * Fail closed — never mark bookings/milestones paid without Stripe.
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function requireStripeConfigured() {
  if (stripe) return { ok: true }
  return {
    ok: false,
    status: 503,
    error: 'Stripe is not configured. Set STRIPE_SECRET_KEY before accepting payments.',
  }
}

/** @returns {true} if response already sent (not configured) */
export function rejectIfStripeMissing(res) {
  const check = requireStripeConfigured()
  if (check.ok) return false
  res.status(check.status).json({ error: check.error })
  return true
}
