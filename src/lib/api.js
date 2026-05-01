import { supabase, isSupabaseConfigured } from './supabase.js'

// Relative URL in production (Vercel Functions at same origin).
// VITE_API_URL can override for local dev without the Vite proxy.
const API_URL = import.meta.env.VITE_API_URL ?? ''

async function request(path, options = {}) {
  let token = null
  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token ?? null
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ---- Stripe Connect ----
export const stripeConnect = {
  createAccount: (email, artistId) =>
    request('/api/stripe/connect/create', {
      method: 'POST',
      body: JSON.stringify({ email, artistId }),
    }),

  getOnboardingLink: (accountId) =>
    request('/api/stripe/connect/onboard', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),

  getStatus: (accountId) =>
    request(`/api/stripe/connect/status/${accountId}`),
}

// ---- Payments ----
export const payments = {
  createIntent: ({ amount, artistStripeAccountId, bookingId, description }) =>
    request('/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, artistStripeAccountId, bookingId, description }),
    }),

  createCheckout: ({ amount, artistName, description, bookingId, artistStripeAccountId }) =>
    request('/api/payments/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ amount, artistName, description, bookingId, artistStripeAccountId }),
    }),

  getStatus: (paymentIntentId) =>
    request(`/api/payments/${paymentIntentId}`),
}

// ---- Bookings ----
export const bookings = {
  create: (data) =>
    request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  respond: (bookingId, action) =>
    request(`/api/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),

  payForBooking: (bookingId) =>
    request(`/api/bookings/${bookingId}/pay`, {
      method: 'POST',
    }),

  list: () => request('/api/bookings'),
}

// ---- Health ----
export const checkHealth = () => request('/api/health')
