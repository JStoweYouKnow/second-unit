import { supabase, isSupabaseConfigured } from './supabase.js'
import { resolveApiBaseUrl } from './apiBaseUrl.js'

// Relative URL in production (Vercel Functions at same origin).
// VITE_API_URL can override for local dev without the Vite proxy.
const API_URL = resolveApiBaseUrl()

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
  const isJson = res.headers.get('content-type')?.includes('application/json')
  if (!isJson) {
    throw new Error(`API endpoint not available (${res.status}): ${path}`)
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ---- Stripe Connect ----
export const stripeConnect = {
  createAccount: async (email, artistId) => {
    if (!isSupabaseConfigured) {
      return { accountId: 'mock_stripe_acct' }
    }
    return request('/api/stripe/connect/create', {
      method: 'POST',
      body: JSON.stringify({ email, artistId }),
    })
  },

  getOnboardingLink: async (accountId) => {
    if (!isSupabaseConfigured) {
      return { url: `${window.location.origin}/account?stripe_setup_success=true` }
    }
    return request('/api/stripe/connect/onboard', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    })
  },

  getStatus: async (accountId) => {
    if (!isSupabaseConfigured) {
      return { charges_enabled: true, details_submitted: true }
    }
    return request(`/api/stripe/connect/status/${accountId}`)
  },
}

// ---- Payments ----
export const payments = {
  createIntent: ({ amount, artistStripeAccountId, bookingId, description }) =>
    request('/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, artistStripeAccountId, bookingId, description }),
    }),

  createCheckout: async (payload) => {
    if (!isSupabaseConfigured) {
      // Mark booking paid in localStorage
      const saved = localStorage.getItem('mock_bookings')
      let list = saved ? JSON.parse(saved) : []
      list = list.map(b => {
        if (String(b.id) === String(payload.bookingId)) {
          return { ...b, status: 'paid' }
        }
        return b
      })
      localStorage.setItem('mock_bookings', JSON.stringify(list))

      return { url: `${window.location.origin}/bookings?payment_success=true` }
    }
    return request('/api/payments/create-checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getStatus: (paymentIntentId) =>
    request(`/api/payments/${paymentIntentId}`),

  list: async () => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('mock_payments')
      return saved ? JSON.parse(saved) : []
    }
    return request('/api/payments')
  },
}

// ---- Bookings ----
export const bookings = {
  create: async (data) => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('mock_bookings')
      const list = saved ? JSON.parse(saved) : []
      const newBooking = {
        ...data,
        id: `mock-booking-${Date.now()}`,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
      list.push(newBooking)
      localStorage.setItem('mock_bookings', JSON.stringify(list))
      return newBooking
    }
    return request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  respond: async (bookingId, action) => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('mock_bookings')
      let list = saved ? JSON.parse(saved) : []
      list = list.map(b => {
        if (String(b.id) === String(bookingId)) {
          return { ...b, status: action === 'confirm' ? 'confirmed' : 'cancelled' }
        }
        return b
      })
      localStorage.setItem('mock_bookings', JSON.stringify(list))
      return { success: true }
    }
    return request(`/api/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    })
  },

  payForBooking: async (bookingId) => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('mock_bookings')
      let list = saved ? JSON.parse(saved) : []
      list = list.map(b => {
        if (String(b.id) === String(bookingId)) {
          return { ...b, status: 'paid' }
        }
        return b
      })
      localStorage.setItem('mock_bookings', JSON.stringify(list))
      return { success: true }
    }
    return request(`/api/bookings/${bookingId}/pay`, {
      method: 'POST',
    })
  },

  complete: async (bookingId) => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('mock_bookings')
      let list = saved ? JSON.parse(saved) : []
      let completedBooking = null
      list = list.map(b => {
        if (String(b.id) === String(bookingId)) {
          completedBooking = { ...b, status: 'completed' }
          return completedBooking
        }
        return b
      })
      localStorage.setItem('mock_bookings', JSON.stringify(list))
      
      if (completedBooking) {
        const savedPayments = localStorage.getItem('mock_payments')
        const paymentsList = savedPayments ? JSON.parse(savedPayments) : []
        paymentsList.push({
          id: `mock-payment-${Date.now()}`,
          bookingId: completedBooking.id,
          amount: completedBooking.agreedTotal,
          artistName: completedBooking.artistName,
          status: 'succeeded',
          createdAt: new Date().toISOString()
        })
        localStorage.setItem('mock_payments', JSON.stringify(paymentsList))
      }
      return { success: true }
    }
    return request(`/api/bookings/${bookingId}/complete`, {
      method: 'POST',
    })
  },

  list: async () => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('mock_bookings')
      return saved ? JSON.parse(saved) : []
    }
    return request('/api/bookings')
  },
}

// ---- Health ----
export const checkHealth = () => {
  if (!isSupabaseConfigured) return Promise.resolve({ status: 'ok', mock: true })
  return request('/api/health')
}

// ---- Conversations ----
export const conversations = {
  list: async () => {
    if (!isSupabaseConfigured) return JSON.parse(localStorage.getItem('mock_conversations') || '[]')
    return request('/api/conversations')
  },

  create: (artistId) =>
    request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ artistId }),
    }),

  send: (conversationId, text) =>
    request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ conversationId, text }),
    }),

  markRead: (conversationId) =>
    request(`/api/conversations/${conversationId}/read`, { method: 'PATCH' }),
}

// ---- Contracts ----
export const contracts = {
  list: async () => {
    if (!isSupabaseConfigured) return JSON.parse(localStorage.getItem('mock_contracts') || '[]')
    return request('/api/contracts')
  },

  create: (payload) =>
    request('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sign: (contractId, name) =>
    request(`/api/contracts/${contractId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  updateAttachment: (contractId, payload) =>
    request(`/api/contracts/${contractId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  payMilestone: (contractId, milestoneId) =>
    request(`/api/contracts/${contractId}/milestones/${milestoneId}/pay`, {
      method: 'POST',
    }),

  approveMilestone: (contractId, milestoneId) =>
    request(`/api/contracts/${contractId}/milestones/${milestoneId}/approve`, {
      method: 'POST',
    }),

  listMilestones: (contractId) => request(`/api/contracts/${contractId}/milestones`),
}

// ---- Notifications ----
export const notifications = {
  list: () => request('/api/notifications'),

  markRead: (id) =>
    request(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    request('/api/notifications/read', { method: 'PATCH' }),
}

// ---- Profile ----
export const profileApi = {
  getNotificationPrefs: () => request('/api/profile/notification-prefs'),

  updateNotificationPrefs: (prefs) =>
    request('/api/profile/notification-prefs', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),
}

// ---- Stripe billing ----
export const billing = {
  listPaymentMethods: () => request('/api/stripe/billing/payment-methods'),

  createSetupSession: () =>
    request('/api/stripe/billing/setup', { method: 'POST' }),
}

// ---- Disputes ----
export const disputes = {
  list: () => request('/api/disputes'),

  get: (id) => request(`/api/disputes/${id}`),

  create: (payload) =>
    request('/api/disputes', { method: 'POST', body: JSON.stringify(payload) }),

  addEvidence: (id, payload) =>
    request(`/api/disputes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  resolve: (id, payload) =>
    request(`/api/disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify(payload) }),
}

// ---- Google Calendar ----
export const calendar = {
  getStatus: () => request('/api/calendar/status'),

  connect: () => request('/api/calendar/connect', { method: 'POST' }),

  disconnect: () => request('/api/calendar/status', { method: 'DELETE' }),

  sync: () => request('/api/calendar/status', { method: 'POST' }),

  getFeedToken: () => request('/api/calendar/feed-token'),
}

// ---- Portfolio media ----
export const portfolio = {
  list: () => request('/api/portfolio'),

  create: (payload) =>
    request('/api/portfolio', { method: 'POST', body: JSON.stringify(payload) }),

  remove: (id) => request(`/api/portfolio/${id}`, { method: 'DELETE' }),

  reorder: (ids) =>
    request('/api/portfolio/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),
}

// ---- Reviews ----
export const reviews = {
  list: (artistId) => request(`/api/reviews?artistId=${encodeURIComponent(artistId)}`),

  submit: (payload) =>
    request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  setVisibility: (reviewId, visible) =>
    request(`/api/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify({ visible }),
    }),

  updateSettings: (payload) =>
    request('/api/reviews/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  respond: (reviewId, response) =>
    request(`/api/reviews/${reviewId}/respond`, {
      method: 'PATCH',
      body: JSON.stringify({ response }),
    }),
}

// ---- Web Push ----
export const push = {
  subscribe: (subscription) =>
    request('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),

  unsubscribe: (endpoint) =>
    request('/api/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    }),

  getVapidPublicKey: () => request('/api/push/vapid-public-key'),
}

// ---- Artist admin (brand verification) ----
export const artists = {
  verifyBrand: (artistId, brandName, verified) =>
    request(`/api/artists/${artistId}/brands`, {
      method: 'PATCH',
      body: JSON.stringify({ brandName, verified }),
    }),
}
