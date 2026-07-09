import Stripe from 'stripe'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

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
