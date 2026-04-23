const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
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

  getStatus: (paymentIntentId) =>
    request(`/api/payments/${paymentIntentId}`),

  // Mock fallback
  createMockIntent: (amount) =>
    request('/api/mock/payment-intent', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
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
