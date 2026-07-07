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
import path from 'path'
import { fileURLToPath } from 'url'
import { validateInviteToken } from '../api/_lib/validateInvite.js'
import { db } from '../api/_lib/db.js'
import { requireAuth } from '../api/_lib/auth.js'
import {
  mapBookingToClient,
  mapBookingToDb,
  listBookingsForUser,
  getArtistIdForProfile,
} from '../api/_lib/bookings.js'
import { listPaymentsForUser } from '../api/_lib/payments.js'
import { completeBookingPayment } from '../api/_lib/completeBookingPayment.js'
import {
  listConversationsForUser,
  getOrCreateConversation,
  sendConversationMessage,
  markConversationRead,
  mapConversationToClient,
} from '../api/_lib/messages.js'
import {
  listContractsForUser,
  mapContractToClient,
  mapContractToDb,
  signContract,
  updateContractAttachment,
} from '../api/_lib/contracts.js'
import {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPrefs,
  updateNotificationPrefs,
} from '../api/_lib/notifications.js'
import { ensureContractForBooking } from '../api/_lib/bookingContract.js'
import { notifyBookingConfirmed } from '../api/_lib/notificationEvents.js'
import { syncBookingToConnectedCalendars } from '../api/_lib/googleCalendar.js'
import {
  listDisputesForUser,
  createDispute,
  getDisputeById,
  addDisputeEvidence,
  resolveDispute,
  updateDisputeStatus,
  isAdmin,
} from '../api/_lib/disputes.js'
import {
  isGoogleCalendarConfigured,
  createOAuthState,
  buildGoogleAuthUrl,
  consumeOAuthState,
  exchangeCodeForTokens,
  saveCalendarConnection,
  importGoogleBusyBlocks,
  getCalendarConnectionStatus,
  disconnectCalendar,
} from '../api/_lib/googleCalendar.js'
import { buildIcalCalendar, ensureCalendarFeedToken, getProfileIdForFeedToken } from '../api/_lib/icalFeed.js'
import { FRONTEND_URL } from '../api/_lib/stripe.js'
import { createNotification } from '../api/_lib/notifications.js'
import {
  listReviewsForArtist,
  upsertReview,
  updateReviewVisibility,
  updateArtistReviewSettings,
  getArtistReviewSettings,
  upsertReviewResponse,
} from '../api/_lib/reviews.js'
import {
  getVapidPublicKey,
  isPushConfigured,
  savePushSubscription,
  removePushSubscription,
} from '../api/_lib/push.js'
import { updateNotificationPrefs } from '../api/_lib/notifications.js'
import {
  listMilestonesForContract,
  ensureContractMilestones,
  userCanAccessMilestoneContract,
  completeMilestonePayment,
  releaseMilestonePayout,
  getMilestoneWithContract,
  canPayMilestone,
  mapMilestoneToClient,
} from '../api/_lib/milestones.js'
import { FRONTEND_URL } from '../api/_lib/stripe.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || process.env.API_PORT || 3001
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
  artistId: z.string().uuid(),
  artistName: z.string(),
  date: z.string(),
  time: z.string().optional().default('09:00'),
  duration: z.number().positive(),
  durationUnit: z.enum(['hours', 'days', 'project']).optional().default('hours'),
  type: z.string(),
  agreedTotal: z.number().positive(),
  notes: z.string().optional(),
})

const MessageSchema = z.object({
  conversationId: z.string().uuid(),
  recipientId: z.string().uuid(),
  text: z.string().min(1),
  senderName: z.string(),
  senderAvatar: z.string().optional(),
  senderRole: z.enum(['employer', 'artist']).optional(),
  id: z.string().optional(),
  timestamp: z.string().optional(),
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

  socket.on('message:send', async (data) => {
    try {
      const validatedData = MessageSchema.parse(data)
      const { conversationId, recipientId, text, senderName, senderAvatar, senderRole } = validatedData
      const senderId = onlineUsers.get(socket.id)
      if (!senderId) return

      const database = db || supabase

      if (database) {
        const message = {
          id: validatedData.id || `msg_${Date.now()}`,
          conversationId,
          senderId,
          senderName,
          senderAvatar,
          text,
          senderRole,
          timestamp: validatedData.timestamp || new Date().toISOString(),
        }

        io.to(`user:${recipientId}`).emit('message:receive', message)
        socket.emit('message:sent', message)

        addNotification(recipientId, {
          type: 'message',
          title: `New message from ${senderName}`,
          body: text.length > 80 ? text.slice(0, 80) + '...' : text,
          link: '/messages',
          avatar: senderAvatar,
        })
        return
      }

      const message = {
        id: `msg_${Date.now()}`,
        conversationId,
        senderId,
        senderName,
        senderAvatar,
        text,
        senderRole,
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
      console.error('Validation error on message:send:', err.errors || err.message)
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
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const validatedData = BookingSchema.parse(req.body)
    const database = db || supabase

    if (database) {
      const row = mapBookingToDb(validatedData, user.id)
      const { data, error } = await database.from('bookings').insert(row).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(mapBookingToClient(data))
    }

    const booking = {
      id: `bk_${Date.now()}`,
      ...validatedData,
      employerId: user.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    bookingsStore.push(booking)
    res.status(201).json(booking)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/bookings', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const database = db || supabase
  if (database) {
    try {
      const bookings = await listBookingsForUser(database, user.id)
      return res.json(bookings)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.json(bookingsStore.filter((b) => b.employerId === user.id))
})

app.get('/api/payments', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const database = db || supabase
  if (!database) return res.json([])

  try {
    const payments = await listPaymentsForUser(database, user.id)
    return res.json(payments)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ---- Stripe Connect Routes ----
app.post('/api/stripe/connect/create', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })

  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const { email, artistId } = req.body
    const account = await stripe.accounts.create({
      type: 'express',
      email: email || user.email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    })

    const database = db || supabase
    if (artistId && database) {
      await database
        .from('artists')
        .update({ stripe_account_id: account.id, updated_at: new Date().toISOString() })
        .eq('id', artistId)
    }

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

app.post('/api/payments/create-checkout', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { amount, artistName, description, bookingId } = req.body
  const database = db || supabase

  if (bookingId && database) {
    const { data: booking } = await database
      .from('bookings')
      .select('employer_id')
      .eq('id', bookingId)
      .maybeSingle()

    if (booking && booking.employer_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to pay for this booking' })
    }
  }

  if (!stripe) {
    if (bookingId && database) {
      await completeBookingPayment(database, bookingId, { paymentIntentId: null })
    }
    return res.json({
      url: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${bookingId || ''}`,
    })
  }

  try {
    // Separate charges model: full payment lands on the platform account.
    // Platform keeps its 15% immediately; artist's 85% is released on project completion.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: description || `Booking with ${artistName}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        metadata: { bookingId: bookingId || '' },
      },
      metadata: { bookingId: bookingId || '' },
      success_url: `${FRONTEND_URL}/bookings?payment_success=1&booking_id=${bookingId || ''}`,
      cancel_url: `${FRONTEND_URL}/bookings?payment_cancelled=1`,
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Payment Intent Routes ----
app.post('/api/payments/create-intent', async (req, res) => {
  if (!stripe) return res.json({ clientSecret: 'mock_secret_' + Date.now() })
  try {
    const { amount, bookingId, description } = req.body
    // Separate charges: no transfer_data — full amount lands on platform account.
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: { bookingId, description },
    })
    res.json({ clientSecret: intent.client_secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/bookings/:id/respond', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.params
  const { action } = req.body
  if (!['confirm', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'action must be "confirm" or "decline"' })
  }

  const database = db || supabase
  if (database) {
    const { data: booking, error: fetchError } = await database
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) return res.status(500).json({ error: fetchError.message })
    if (!booking) return res.status(404).json({ error: 'Booking not found' })

    const artistId = await getArtistIdForProfile(database, user.id)
    const isArtist = artistId != null && booking.artist_id === artistId
    if (!isArtist) {
      return res.status(403).json({ error: 'Only the artist can confirm or decline this booking' })
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Booking is no longer pending' })
    }

    const status = action === 'confirm' ? 'confirmed' : 'cancelled'
    const { data, error } = await database
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })

    if (action === 'confirm') {
      await ensureContractForBooking(database, data)
      const { data: artistRow } = await database
        .from('artists')
        .select('profile_id')
        .eq('id', data.artist_id)
        .maybeSingle()
      await notifyBookingConfirmed(database, {
        booking: data,
        employerId: data.employer_id,
        artistProfileId: artistRow?.profile_id ?? null,
      })
      await syncBookingToConnectedCalendars(database, data.id)
      const { data: refreshed, error: refreshError } = await database
        .from('bookings')
        .select(`
          *,
          contract:contracts(
            id,
            title,
            status,
            signed_by_employer,
            signed_by_artist
          )
        `)
        .eq('id', id)
        .single()
      if (!refreshError && refreshed) {
        return res.json(mapBookingToClient(refreshed))
      }
    }

    return res.json(mapBookingToClient(data))
  }

  const booking = bookingsStore.find(b => b.id === id)
  if (booking) booking.status = action === 'confirm' ? 'confirmed' : 'cancelled'
  res.json(booking || { id, status: action === 'confirm' ? 'confirmed' : 'cancelled' })
})

app.post('/api/bookings/:id/pay', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.params
  const database = db || supabase
  if (database) {
    const result = await completeBookingPayment(database, id, { paymentIntentId: null })
    if (result.error) return res.status(500).json({ error: result.error })
    return res.json({ success: true, booking: mapBookingToClient(result.booking) })
  }

  const b = bookingsStore.find(x => x.id === id)
  if (b) b.status = 'paid'
  res.json({ success: true })
})

// Release the artist's 85% payout once the project is complete
app.post('/api/bookings/:id/complete', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.params
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })

  const { data: booking, error: fetchError } = await database
    .from('bookings').select('*').eq('id', id).maybeSingle()
  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  if (booking.employer_id !== user.id) {
    return res.status(403).json({ error: 'Only the hirer can complete this booking' })
  }
  if (booking.status !== 'paid') {
    return res.status(400).json({ error: 'Booking must be in paid status before it can be completed' })
  }

  const { data: payment, error: paymentFetchError } = await database
    .from('payments').select('*')
    .eq('booking_id', id).eq('status', 'paid').eq('payout_status', 'pending')
    .maybeSingle()
  if (paymentFetchError) return res.status(500).json({ error: paymentFetchError.message })
  if (!payment) return res.status(404).json({ error: 'No pending payout found for this booking' })

  if (stripe && payment.artist_stripe_account_id) {
    const account = await stripe.accounts.retrieve(payment.artist_stripe_account_id).catch(() => null)
    if (!account?.payouts_enabled) {
      return res.status(400).json({
        error: 'Artist has not completed Stripe onboarding and cannot receive payouts yet',
      })
    }
    let transfer
    try {
      transfer = await stripe.transfers.create({
        amount: payment.artist_payout_amount,
        currency: 'usd',
        destination: payment.artist_stripe_account_id,
        transfer_group: id,
        metadata: { bookingId: id },
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
    await database.from('payments')
      .update({ payout_status: 'paid', transfer_id: transfer.id }).eq('id', payment.id)
  } else {
    await database.from('payments').update({ payout_status: 'paid' }).eq('id', payment.id)
  }

  const { data: updatedBooking, error: updateError } = await database
    .from('bookings')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (updateError) return res.status(500).json({ error: updateError.message })
  return res.json(mapBookingToClient(updatedBooking))
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

  const obj = event.data.object
  const meta = { ...(obj?.metadata || {}) }
  if (typeof obj?.payment_intent === 'object' && obj.payment_intent?.metadata) {
    Object.assign(meta, obj.payment_intent.metadata)
  }

  const bookingId = meta.bookingId
  const milestoneId = meta.milestoneId
  const paymentIntentId =
    event.type === 'checkout.session.completed'
      ? (typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id)
      : obj.id

  const database = db || supabase
  if (
    database &&
    (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed')
  ) {
    if (milestoneId) {
      await completeMilestonePayment(database, milestoneId, { paymentIntentId })
    } else if (bookingId) {
      await completeBookingPayment(database, bookingId, { paymentIntentId })
    }
  } else if (bookingId) {
    const booking = bookingsStore.find(b => b.id === bookingId)
    if (booking) booking.status = 'paid'
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

app.get('/api/invites/validate', async (req, res) => {
  const result = await validateInviteToken(supabase, req.query.token)
  res.json(result)
})

app.get('/api/conversations', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const conversations = await listConversationsForUser(database, user.id)
    res.json(conversations)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/conversations', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    if (req.body?.conversationId && req.body?.text) {
      const result = await sendConversationMessage(database, {
        conversationId: req.body.conversationId,
        senderId: user.id,
        body: req.body.text,
      })
      const { data: messages } = await database
        .from('messages')
        .select('*')
        .eq('conversation_id', req.body.conversationId)
        .order('created_at', { ascending: true })
      const artistId = await getArtistIdForProfile(database, user.id)
      const viewerIsArtist = artistId != null && result.conversation.artist_id === artistId
      return res.status(201).json({
        conversation: mapConversationToClient(result.conversation, messages || [], { viewerIsArtist }),
        recipientId: result.recipientId,
      })
    }
    const conversation = await getOrCreateConversation(database, user.id, req.body.artistId)
    const artistId = await getArtistIdForProfile(database, user.id)
    const viewerIsArtist = artistId != null && conversation.artist_id === artistId
    res.status(201).json(mapConversationToClient(conversation, [], { viewerIsArtist }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/conversations/:id/read', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    await markConversationRead(database, req.params.id, user.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
  }
})

app.get('/api/contracts', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    res.json(await listContractsForUser(database, user.id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/contracts', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const row = mapContractToDb(req.body, user.id)
    const { data, error } = await database.from('contracts').insert(row).select(`*, artist:artists(display_name)`).single()
    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json(mapContractToClient(data))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/contracts/:id', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    if (req.body?.attachmentStoragePath) {
      const updated = await updateContractAttachment(database, req.params.id, user.id, {
        attachmentStoragePath: req.body.attachmentStoragePath,
        attachmentName: req.body.attachmentName,
        attachmentMime: req.body.attachmentMime ?? null,
      })
      return res.json(updated)
    }
    const signed = await signContract(database, req.params.id, user.id, { name: req.body.name })
    res.json(signed)
  } catch (err) {
    res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
  }
})

app.get('/api/contracts/:id/milestones', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const { data: contract, error } = await database.from('contracts').select('*').eq('id', req.params.id).single()
    if (error) return res.status(404).json({ error: 'Contract not found' })
    const allowed = await userCanAccessMilestoneContract(database, user.id, contract)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    if (contract.status === 'active' || contract.status === 'completed') {
      await ensureContractMilestones(database, contract)
    }
    res.json(await listMilestonesForContract(database, req.params.id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/contracts/:id/milestones/:milestoneId/pay', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  const { id: contractId, milestoneId } = req.params
  try {
    const { milestone, contract } = await getMilestoneWithContract(database, milestoneId)
    if (milestone.contract_id !== contractId) return res.status(400).json({ error: 'Milestone mismatch' })
    if (contract.employer_id !== user.id) return res.status(403).json({ error: 'Forbidden' })
    const all = await listMilestonesForContract(database, contractId)
    if (!canPayMilestone(mapMilestoneToClient(milestone), all)) {
      return res.status(400).json({ error: 'Complete the previous milestone first' })
    }
    if (!stripe) {
      const result = await completeMilestonePayment(database, milestoneId, { paymentIntentId: null })
      if (result.error) return res.status(400).json({ error: result.error })
      return res.json({ url: `${FRONTEND_URL}/projects?milestone_paid=1&contract_id=${contractId}` })
    }
    const { data: artist } = await database.from('artists').select('display_name').eq('id', contract.artist_id).maybeSingle()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${contract.title} — ${milestone.title}` },
          unit_amount: Math.round(Number(milestone.amount) * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: { metadata: { contractId, milestoneId } },
      metadata: { contractId, milestoneId },
      success_url: `${FRONTEND_URL}/projects?milestone_paid=1&contract_id=${contractId}`,
      cancel_url: `${FRONTEND_URL}/projects?milestone_cancelled=1&contract_id=${contractId}`,
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/contracts/:id/milestones/:milestoneId/approve', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const { milestone } = await getMilestoneWithContract(database, req.params.milestoneId)
    if (milestone.contract_id !== req.params.id) return res.status(400).json({ error: 'Milestone mismatch' })
    const released = await releaseMilestonePayout(database, req.params.milestoneId, user.id)
    res.json(released)
  } catch (err) {
    res.status(err.message.includes('hirer') ? 403 : 400).json({ error: err.message })
  }
})

app.get('/api/reviews', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  const artistId = req.query.artistId
  if (!artistId) return res.status(400).json({ error: 'artistId required' })
  try {
    const reviews = await listReviewsForArtist(database, artistId)
    const settings = await getArtistReviewSettings(database, artistId)
    res.json({ reviews, settings })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/reviews', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const review = await upsertReview(database, user.id, req.body)
    res.status(201).json(review)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/reviews/settings', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const settings = await updateArtistReviewSettings(database, user.id, req.body)
    res.json(settings)
  } catch (err) {
    res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
  }
})

app.patch('/api/reviews/:id', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const review = await updateReviewVisibility(database, req.params.id, user.id, req.body.visible)
    res.json(review)
  } catch (err) {
    res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
  }
})

app.patch('/api/reviews/:id/respond', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const review = await upsertReviewResponse(database, req.params.id, user.id, req.body.response)
    res.json(review)
  } catch (err) {
    const status =
      err.message === 'Forbidden' ? 403
        : err.message.includes('required') || err.message.includes('2000') ? 400
          : 500
    res.status(status).json({ error: err.message })
  }
})

// ---- Web Push ----
app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey(),
  })
})

app.post('/api/push/subscribe', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const userAgent = req.headers['user-agent'] || null
    await savePushSubscription(database, user.id, req.body, userAgent)
    const prefs = await updateNotificationPrefs(database, user.id, { push: true })
    res.status(201).json({ ok: true, prefs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/push/subscribe', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : null
    await removePushSubscription(database, user.id, endpoint)
    const prefs = await updateNotificationPrefs(database, user.id, { push: false })
    res.json({ ok: true, prefs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Notifications (Supabase-backed) ----
app.get('/api/notifications', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    res.json(await listNotificationsForUser(database, user.id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/notifications/read', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    await markAllNotificationsRead(database, user.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/notifications/:id/read', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const updated = await markNotificationRead(database, user.id, req.params.id)
    if (!updated) return res.status(404).json({ error: 'Notification not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/profile/notification-prefs', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    res.json(await getNotificationPrefs(database, user.id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/profile/notification-prefs', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    res.json(await updateNotificationPrefs(database, user.id, req.body || {}))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Disputes ----
const CreateDisputeSchema = z.object({
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(100),
  description: z.string().min(10).max(5000),
  bookingId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
})

const DisputeEvidenceSchema = z.object({
  note: z.string().max(5000).optional().nullable(),
  fileName: z.string().optional().nullable(),
  storagePath: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
})

const DisputeStatusSchema = z.object({
  status: z.enum(['open', 'under_review', 'mediation', 'resolved', 'closed']),
})

const ResolveDisputeSchema = z.object({
  outcome: z.enum(['refund_employer', 'release_artist', 'split', 'no_action']),
  resolutionNotes: z.string().min(1).max(5000),
  splitEmployerCents: z.number().int().min(0).optional().nullable(),
  splitArtistCents: z.number().int().min(0).optional().nullable(),
})

app.get('/api/disputes', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    res.json(await listDisputesForUser(database, user.id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/disputes', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const validated = CreateDisputeSchema.parse(req.body)
    if (!validated.bookingId && !validated.contractId) {
      return res.status(400).json({ error: 'bookingId or contractId required' })
    }
    const dispute = await createDispute(database, user.id, validated)
    if (dispute.respondentId) {
      await createNotification(database, {
        userId: dispute.respondentId,
        type: 'system',
        title: 'Dispute opened against your project',
        body: dispute.title,
        link: `/disputes?id=${dispute.id}`,
      })
    }
    const { data: admins } = await database.from('profiles').select('id').eq('role', 'admin')
    for (const admin of admins || []) {
      await createNotification(database, {
        userId: admin.id,
        type: 'system',
        title: 'New dispute requires review',
        body: dispute.title,
        link: `/admin/disputes?id=${dispute.id}`,
      })
    }
    res.status(201).json(dispute)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/disputes/:id', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const dispute = await getDisputeById(database, req.params.id, user.id)
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' })
    res.json(dispute)
  } catch (err) {
    res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
  }
})

app.patch('/api/disputes/:id', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    if (req.body?.status) {
      const validated = DisputeStatusSchema.parse(req.body)
      const updated = await updateDisputeStatus(database, req.params.id, user.id, validated)
      return res.json(updated)
    }
    const validated = DisputeEvidenceSchema.parse(req.body)
    const evidence = await addDisputeEvidence(database, req.params.id, user.id, validated)
    const dispute = await getDisputeById(database, req.params.id, user.id)
    res.json({ evidence, dispute })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    res.status(err.message === 'Forbidden' ? 403 : 500).json({ error: err.message })
  }
})

app.post('/api/disputes/:id/resolve', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    if (!(await isAdmin(database, user.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const validated = ResolveDisputeSchema.parse(req.body)
    const dispute = await resolveDispute(database, req.params.id, user.id, validated)
    for (const partyId of [dispute.openedBy, dispute.respondentId].filter(Boolean)) {
      await createNotification(database, {
        userId: partyId,
        type: 'system',
        title: 'Dispute resolved',
        body: validated.resolutionNotes.slice(0, 200),
        link: `/disputes?id=${dispute.id}`,
      })
    }
    res.json(dispute)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    res.status(500).json({ error: err.message })
  }
})

// ---- Google Calendar OAuth ----
app.post('/api/calendar/connect', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  if (!isGoogleCalendarConfigured()) {
    return res.status(503).json({ error: 'Google Calendar OAuth is not configured' })
  }
  try {
    const state = await createOAuthState(database, user.id)
    const url = buildGoogleAuthUrl(state)
    res.json({ url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/calendar/callback', async (req, res) => {
  const database = db || supabase
  if (!database) return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
  const { code, state, error: oauthError } = req.query
  if (oauthError || !code || !state) {
    return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
  }
  try {
    const profileId = await consumeOAuthState(database, state)
    if (!profileId) return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) return res.redirect(`${FRONTEND_URL}/account?calendar=error`)
    await saveCalendarConnection(database, profileId, tokens)
    const artistId = await getArtistIdForProfile(database, profileId)
    if (artistId) await importGoogleBusyBlocks(database, profileId, artistId)
    res.redirect(`${FRONTEND_URL}/account?calendar=connected`)
  } catch (err) {
    console.error('[calendar] callback error:', err.message)
    res.redirect(`${FRONTEND_URL}/account?calendar=error`)
  }
})

app.get('/api/calendar/status', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    res.json(await getCalendarConnectionStatus(database, user.id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/calendar/status', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    await disconnectCalendar(database, user.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/calendar/status', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const artistId = await getArtistIdForProfile(database, user.id)
    let imported = 0
    if (artistId) {
      const result = await importGoogleBusyBlocks(database, user.id, artistId)
      imported = result.imported
    } else {
      const result = await importGoogleBusyBlocks(database, user.id, null)
      imported = result.imported
    }
    const bookings = await listBookingsForUser(database, user.id)
    for (const b of bookings) {
      if (b.status === 'confirmed' || b.status === 'paid') {
        await syncBookingToConnectedCalendars(database, b.id)
      }
    }
    res.json({ ok: true, importedBusyBlocks: imported })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/calendar/feed/:token', async (req, res) => {
  const database = db || supabase
  if (!database) return res.status(503).send('Database not configured')
  try {
    const profile = await getProfileIdForFeedToken(database, req.params.token)
    if (!profile) return res.status(404).send('Feed not found')
    const artistId = (await getArtistIdForProfile(database, profile.id)) ?? null
    let bookingsQuery = database
      .from('bookings')
      .select('id, date, start_time, end_time, booking_type, status, artist_name')
      .in('status', ['confirmed', 'paid', 'completed'])
      .order('date', { ascending: true })
    if (artistId) {
      bookingsQuery = bookingsQuery.or(`employer_id.eq.${profile.id},artist_id.eq.${artistId}`)
    } else {
      bookingsQuery = bookingsQuery.eq('employer_id', profile.id)
    }
    const { data: bookings } = await bookingsQuery
    const ical = buildIcalCalendar({
      name: `The Callsheet — ${profile.full_name || 'Bookings'}`,
      events: (bookings || []).map((b) => ({
        uid: b.id,
        date: String(b.date).slice(0, 10),
        startTime: b.start_time || '09:00:00',
        endTime: b.end_time || '10:00:00',
        summary: `The Callsheet — ${b.booking_type || 'Booking'}`,
        description: `${b.artist_name || 'Artist'} · ${FRONTEND_URL}/bookings`,
      })),
    })
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.send(ical)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

app.get('/api/calendar/feed-token', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  try {
    const token = await ensureCalendarFeedToken(database, user.id)
    res.json({ token, feedUrl: `${FRONTEND_URL}/api/calendar/feed/${token}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const PortfolioReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

app.get('/api/portfolio', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  const artistId = await getArtistIdForProfile(database, user.id)
  if (!artistId) return res.status(403).json({ error: 'Artist profile required' })
  const { data, error } = await database
    .from('portfolio_items')
    .select('*')
    .eq('artist_id', artistId)
    .order('sort_order', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

app.post('/api/portfolio', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  const artistId = await getArtistIdForProfile(database, user.id)
  if (!artistId) return res.status(403).json({ error: 'Artist profile required' })
  try {
    const body = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional().nullable(),
      mediaUrl: z.string().url(),
      mediaType: z.enum(['image', 'video']).default('image'),
      storagePath: z.string().optional().nullable(),
      sortOrder: z.number().int().min(0).optional(),
    }).parse(req.body)
    const { data, error } = await database
      .from('portfolio_items')
      .insert({
        artist_id: artistId,
        title: body.title,
        description: body.description ?? null,
        media_url: body.mediaUrl,
        media_type: body.mediaType,
        storage_path: body.storagePath ?? null,
        sort_order: body.sortOrder ?? 0,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json(data)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/portfolio/reorder', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  const artistId = await getArtistIdForProfile(database, user.id)
  if (!artistId) return res.status(403).json({ error: 'Artist profile required' })
  try {
    const { ids } = PortfolioReorderSchema.parse(req.body)
    const { data: existing, error: fetchError } = await database
      .from('portfolio_items')
      .select('id')
      .eq('artist_id', artistId)
    if (fetchError) return res.status(500).json({ error: fetchError.message })
    const owned = new Set((existing || []).map((r) => r.id))
    if (!ids.every((id) => owned.has(id)) || ids.length !== owned.size) {
      return res.status(400).json({ error: 'Invalid portfolio item order' })
    }
    for (let i = 0; i < ids.length; i++) {
      const { error } = await database
        .from('portfolio_items')
        .update({ sort_order: i })
        .eq('id', ids[i])
        .eq('artist_id', artistId)
      if (error) return res.status(500).json({ error: error.message })
    }
    const { data, error } = await database
      .from('portfolio_items')
      .select('*')
      .eq('artist_id', artistId)
      .order('sort_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/portfolio/:id', async (req, res) => {
  const user = await requireAuth(req, res)
  if (!user) return
  const database = db || supabase
  if (!database) return res.status(503).json({ error: 'Database not configured' })
  const artistId = await getArtistIdForProfile(database, user.id)
  if (!artistId) return res.status(403).json({ error: 'Artist profile required' })
  const { data: row, error: fetchError } = await database
    .from('portfolio_items')
    .select('id, storage_path')
    .eq('id', req.params.id)
    .eq('artist_id', artistId)
    .maybeSingle()
  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!row) return res.status(404).json({ error: 'Portfolio item not found' })
  const { error } = await database.from('portfolio_items').delete().eq('id', req.params.id).eq('artist_id', artistId)
  if (error) return res.status(500).json({ error: error.message })
  if (row.storage_path) {
    await database.storage.from('portfolio-media').remove([row.storage_path]).catch(() => {})
  }
  res.json({ ok: true })
})

// =============================================
// FRONTEND SERVING (Monolith Fallback)
// =============================================
const distPath = path.join(__dirname, '../dist')
app.use(express.static(distPath))

// Express 5 / path-to-regexp v8: bare '*' is invalid; use a named wildcard
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' })
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next(err)
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
  console.log(`\n🚀 The Callsheet API running on http://localhost:${PORT}`)
  console.log(`   Security: ✅ Helmet + Rate Limiting`)
  console.log(`   Persistence: ${supabase ? '✅ Supabase' : '⚠️  In-memory'}`)
  console.log()
})
