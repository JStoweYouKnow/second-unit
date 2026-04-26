import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import Stripe from 'stripe'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.API_PORT || 3001
let FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Fix: Ensure FRONTEND_URL has a protocol (required by CORS policy)
if (FRONTEND_URL && !FRONTEND_URL.startsWith('http')) {
  FRONTEND_URL = `https://${FRONTEND_URL}`
}

// ---- Security Middleware (Items 2 & 3) ----
app.use(helmet()) // Security headers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
})
app.use('/api/', limiter) // Apply rate limiting to all API routes

// ---- Supabase Setup (Item 5) ----
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null

// ---- Stripe Setup ----
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

// Socket.io setup
const io = new Server(httpServer, {
  cors: { 
    origin: FRONTEND_URL, 
    methods: ['GET', 'POST'],
    credentials: true
  },
})

// Stripe webhook needs raw body
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleWebhook)

app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())

// ---- Validation Schemas (Item 4) ----
const BookingSchema = z.object({
  artistId: z.string().or(z.number()),
  artistName: z.string(),
  employerId: z.string(),
  date: z.string(),
  time: z.string(),
  duration: z.number().positive(),
  durationUnit: z.enum(['hours', 'days', 'project']).optional().default('hours'),
  type: z.string(),
  agreedTotal: z.number().positive(),
  notes: z.string().optional(),
})

const MessageSchema = z.object({
  conversationId: z.string().or(z.number()),
  recipientId: z.string().or(z.number()),
  text: z.string().min(1),
  senderName: z.string(),
  senderAvatar: z.string().optional()
})

// =============================================
// IN-MEMORY STORES (Fallback if Supabase is missing)
// =============================================
const bookingsStore = []
const conversationsStore = new Map()
const notificationsStore = new Map()
const onlineUsers = new Map()

// =============================================
// SOCKET.IO
// =============================================
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`)

  socket.on('register', (userId) => {
    onlineUsers.set(socket.id, userId)
    socket.join(`user:${userId}`)
    
    // Send pending notifications
    const pending = notificationsStore.get(userId) || []
    const unread = pending.filter(n => !n.read)
    if (unread.length > 0) socket.emit('notifications:unread', unread)
  })

  socket.on('message:send', (data) => {
    try {
      const validatedData = MessageSchema.parse(data)
      const { conversationId, recipientId, text, senderName, senderAvatar } = validatedData
      const senderId = onlineUsers.get(socket.id)
      if (!senderId) return

      const message = {
        id: `msg_${Date.now()}`,
        conversationId,
        senderId,
        senderName,
        senderAvatar,
        text,
        timestamp: new Date().toISOString(),
      }

      if (!conversationsStore.has(conversationId)) {
        conversationsStore.set(conversationId, { messages: [] })
      }
      conversationsStore.get(conversationId).messages.push(message)

      io.to(`user:${recipientId}`).emit('message:receive', message)
      socket.emit('message:sent', message)

      addNotification(recipientId, {
        type: 'message',
        title: `New message from ${senderName}`,
        body: text.length > 80 ? text.slice(0, 80) + '...' : text,
        link: '/messages',
        avatar: senderAvatar,
      })
    } catch (err) {
      console.error('Validation error on message:send:', err.errors)
    }
  })

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id)
  })
})

function addNotification(userId, { type, title, body, link, avatar }) {
  const notification = {
    id: `notif_${Date.now()}`,
    type, title, body, link, avatar,
    read: false,
    createdAt: new Date().toISOString(),
  }

  if (!notificationsStore.has(userId)) notificationsStore.set(userId, [])
  notificationsStore.get(userId).unshift(notification)
  io.to(`user:${userId}`).emit('notification:new', notification)
}

// =============================================
// API ROUTES
// =============================================

app.post('/api/bookings', async (req, res) => {
  try {
    const validatedData = BookingSchema.parse(req.body)
    const { artistId, artistName, employerId, date, time, duration, type, agreedTotal, notes } =
      validatedData

    const booking = {
      id: `bk_${Date.now()}`,
      ...validatedData,
      status: 'pending',
      totalAmount: agreedTotal,
      createdAt: new Date().toISOString(),
    }

    // Persist to Supabase if available (Item 5)
    if (supabase) {
      const { data, error } = await supabase.from('bookings').insert([booking]).select()
      if (error) console.error('Supabase Insert Error:', error)
    } else {
      bookingsStore.push(booking)
    }

    addNotification(artistId, {
      type: 'booking',
      title: 'New booking request',
      body: `${type} on ${date} at ${time}`,
      link: '/bookings',
    })

    res.json(booking)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/bookings', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('bookings').select('*')
    if (!error) return res.json(data)
  }
  res.json(bookingsStore)
})

// ---- Stripe Connect Routes ----
app.post('/api/stripe/connect/create', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })
  try {
    const { email, artistId } = req.body
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    })
    res.json({ accountId: account.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/stripe/connect/onboard', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })
  try {
    const { accountId } = req.body
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${FRONTEND_URL}/payments?stripe_refresh=1`,
      return_url: `${FRONTEND_URL}/payments?stripe_success=1`,
      type: 'account_onboarding',
    })
    res.json({ url: accountLink.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Payment Intent Routes ----
app.post('/api/payments/create-intent', async (req, res) => {
  if (!stripe) return res.json({ clientSecret: 'mock_secret_' + Date.now() })
  try {
    const { amount, artistStripeAccountId, bookingId, description } = req.body
    const intent = await stripe.paymentIntents.create({
      amount: amount * 100, // cents
      currency: 'usd',
      application_fee_amount: Math.round(amount * 10), // 10% platform fee
      transfer_data: { destination: artistStripeAccountId },
      metadata: { bookingId, description },
    })
    res.json({ clientSecret: intent.client_secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/bookings/:id/pay', async (req, res) => {
  const { id } = req.params
  // In a real app, this would trigger a payment or verify it
  // For the demo, we just update the status
  if (supabase) {
    await supabase.from('bookings').update({ status: 'paid' }).eq('id', id)
  } else {
    const b = bookingsStore.find(x => x.id === id)
    if (b) b.status = 'paid'
  }
  res.json({ success: true })
})

async function handleWebhook(req, res) {
  if (!stripe) return res.status(503).send('Stripe not configured')
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle successful payments
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    const bookingId = pi.metadata.bookingId
    if (supabase) {
      await supabase.from('bookings').update({ status: 'paid' }).eq('id', bookingId)
    } else {
      const booking = bookingsStore.find(b => b.id === bookingId)
      if (booking) booking.status = 'paid'
    }
  }
  res.json({ received: true })
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    stripe: !!stripe,
    supabase: !!supabase,
    mode: stripe ? 'live' : 'mock',
    connections: onlineUsers.size,
  })
})

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use (another API server?). Stop it or set API_PORT, e.g.:\n  API_PORT=3002 npm run dev:server\n`)
  } else {
    console.error(err)
  }
  process.exit(1)
})

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Second Unit API running on http://localhost:${PORT}`)
  console.log(`   Security: ✅ Helmet + Rate Limiting`)
  console.log(`   Persistence: ${supabase ? '✅ Supabase' : '⚠️  In-memory'}`)
  console.log()
})
