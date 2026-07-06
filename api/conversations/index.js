import { z } from 'zod'
import { db } from '../_lib/db.js'
import { requireAuth } from '../_lib/auth.js'
import { rateLimit, getClientIp } from '../_lib/ratelimit.js'
import {
  listConversationsForUser,
  getOrCreateConversation,
  sendConversationMessage,
  markConversationRead,
  mapConversationToClient,
} from '../_lib/messages.js'
import { getArtistIdForProfile } from '../_lib/bookings.js'

const CreateSchema = z.object({
  artistId: z.string().uuid(),
})

const SendSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().min(1).max(5000),
})

export default async function handler(req, res) {
  const { ok } = rateLimit(getClientIp(req), 60, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const user = await requireAuth(req, res)
  if (!user) return

  if (!db) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    try {
      const conversations = await listConversationsForUser(db, user.id)
      return res.json(conversations)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {}

      if (body.conversationId && body.text) {
        const validated = SendSchema.parse(body)
        const result = await sendConversationMessage(db, {
          conversationId: validated.conversationId,
          senderId: user.id,
          body: validated.text,
        })

        const artistId = await getArtistIdForProfile(db, user.id)
        const viewerIsArtist =
          artistId != null && result.conversation.artist_id === artistId

        const { data: messages } = await db
          .from('messages')
          .select('*')
          .eq('conversation_id', validated.conversationId)
          .order('created_at', { ascending: true })

        const clientConv = mapConversationToClient(
          { ...result.conversation, last_message: validated.text, last_message_at: result.message.created_at },
          messages || [],
          { viewerIsArtist }
        )

        return res.status(201).json({
          conversation: clientConv,
          recipientId: result.recipientId,
        })
      }

      const validated = CreateSchema.parse(body)
      const conversation = await getOrCreateConversation(db, user.id, validated.artistId)
      const artistId = await getArtistIdForProfile(db, user.id)
      const viewerIsArtist = artistId != null && conversation.artist_id === artistId
      return res.status(201).json(
        mapConversationToClient(conversation, [], { viewerIsArtist })
      )
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
