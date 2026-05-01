import Stripe from 'stripe'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

export const FRONTEND_URL = (() => {
  let url = process.env.FRONTEND_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')
  if (url && !url.startsWith('http')) url = `https://${url}`
  return url.replace(/\/$/, '')
})()
