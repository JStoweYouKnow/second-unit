import { getArtistIdForProfile } from './bookings.js'
import { notifyMessageReceived } from './notificationEvents.js'
import { hasSignedContractBetween } from './confidentiality.js'

function formatMessageTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function messageReadByRecipient(row, conversation, viewerIsArtist) {
  if (!conversation) return false
  const fromMe = viewerIsArtist
    ? row.sender_role === 'artist'
    : row.sender_role === 'employer'
  if (!fromMe) return false

  const recipientReadAt = viewerIsArtist
    ? conversation.employer_last_read_at
    : conversation.artist_last_read_at
  if (!recipientReadAt) return false
  return new Date(recipientReadAt) >= new Date(row.created_at)
}

function mapMessageToThread(row, viewerIsArtist, conversation) {
  const fromEmployer = row.sender_role === 'employer'
  const sender = viewerIsArtist
    ? (fromEmployer ? 'user' : 'artist')
    : (fromEmployer ? 'user' : 'artist')
  return {
    id: row.id,
    sender,
    text: row.body,
    attachmentName: row.attachment_name ?? null,
    attachmentMime: row.attachment_mime ?? null,
    attachmentStoragePath: row.attachment_storage_path ?? null,
    time: formatMessageTime(row.created_at),
    createdAt: row.created_at,
    read: messageReadByRecipient(row, conversation, viewerIsArtist),
  }
}

export function mapConversationToClient(row, messages, { viewerIsArtist }) {
  const artist = row.artist
  const artistName = artist?.display_name ?? row.artist_name ?? 'Artist'
  const unread = viewerIsArtist ? (row.artist_unread ?? 0) > 0 : (row.employer_unread ?? 0) > 0

  return {
    id: row.id,
    artistId: row.artist_id,
    artistProfileId: artist?.profile_id ?? null,
    employerId: row.employer_id,
    artistName,
    avatar: artistName.split(' ').map((n) => n[0]).join('').slice(0, 2),
    // Per-conversation role of the viewer. A user who is both an artist and a
    // hirer sees threads from both sides; the client renders each thread using
    // this flag rather than a single global role.
    viewerIsArtist: !!viewerIsArtist,
    unread,
    lastMessage: row.last_message ?? '',
    time: formatMessageTime(row.last_message_at) || 'Now',
    thread: (messages || []).map((m) => mapMessageToThread(m, viewerIsArtist, row)),
  }
}

export async function listConversationsForUser(db, userId) {
  const artistId = await getArtistIdForProfile(db, userId)

  let query = db
    .from('conversations')
    .select(`
      *,
      artist:artists(id, display_name, profile_id)
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (artistId) {
    // The user may be an artist AND a hirer — return threads from both sides so
    // hirer-side conversations they start don't disappear on the next fetch.
    query = query.or(`employer_id.eq.${userId},artist_id.eq.${artistId}`)
  } else {
    query = query.eq('employer_id', userId)
  }

  const { data: conversations, error } = await query
  if (error) throw error
  if (!conversations?.length) return []

  const ids = conversations.map((c) => c.id)
  const { data: allMessages, error: msgError } = await db
    .from('messages')
    .select('*')
    .in('conversation_id', ids)
    .order('created_at', { ascending: true })

  if (msgError) throw msgError

  const byConv = new Map()
  for (const m of allMessages || []) {
    if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, [])
    byConv.get(m.conversation_id).push(m)
  }

  return conversations.map((c) => {
    const viewerIsArtist = artistId != null && c.artist_id === artistId
    return mapConversationToClient(c, byConv.get(c.id) || [], { viewerIsArtist })
  })
}

export async function getOrCreateConversation(db, employerId, artistId) {
  const { data: existing } = await db
    .from('conversations')
    .select(`
      *,
      artist:artists(id, display_name, profile_id)
    `)
    .eq('employer_id', employerId)
    .eq('artist_id', artistId)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await db
    .from('conversations')
    .insert({ employer_id: employerId, artist_id: artistId })
    .select(`
      *,
      artist:artists(id, display_name, profile_id)
    `)
    .single()

  if (error) throw error
  return data
}

export async function userCanAccessConversation(db, userId, conversationRow) {
  if (!conversationRow) return false
  if (conversationRow.employer_id === userId) return true
  const artistId = await getArtistIdForProfile(db, userId)
  return artistId != null && conversationRow.artist_id === artistId
}

export async function sendConversationMessage(db, {
  conversationId,
  senderId,
  body,
  attachmentStoragePath = null,
  attachmentName = null,
  attachmentMime = null,
}) {
  const trimmed = body?.trim() || ''
  const hasAttachment = Boolean(attachmentStoragePath && attachmentName)
  if (!trimmed && !hasAttachment) throw new Error('Message text or attachment required')

  const { data: conversation, error: convError } = await db
    .from('conversations')
    .select('*, artist:artists(profile_id)')
    .eq('id', conversationId)
    .single()

  if (convError) throw convError

  const canAccess = await userCanAccessConversation(db, senderId, conversation)
  if (!canAccess) throw new Error('Forbidden')

  if (hasAttachment) {
    const signed = await hasSignedContractBetween(db, conversation.employer_id, conversation.artist_id)
    if (!signed) {
      throw new Error('Sign a project agreement before sharing confidential attachments in messages')
    }
  }

  const senderRole = conversation.employer_id === senderId ? 'employer' : 'artist'

  const previewText = trimmed || `[Attachment: ${attachmentName}]`

  const { data: message, error: msgError } = await db
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      body: trimmed || `[Attachment: ${attachmentName}]`,
      attachment_storage_path: attachmentStoragePath,
      attachment_name: attachmentName,
      attachment_mime: attachmentMime,
    })
    .select()
    .single()

  if (msgError) throw msgError

  const isEmployerSender = senderRole === 'employer'
  const updatePatch = {
    last_message: previewText.slice(0, 500),
    last_message_at: message.created_at,
    employer_unread: isEmployerSender
      ? conversation.employer_unread
      : (conversation.employer_unread ?? 0) + 1,
    artist_unread: isEmployerSender
      ? (conversation.artist_unread ?? 0) + 1
      : conversation.artist_unread,
  }

  await db.from('conversations').update(updatePatch).eq('id', conversationId)

  const artistProfileId = conversation.artist?.profile_id
  const recipientId = isEmployerSender ? artistProfileId : conversation.employer_id

  const { data: senderProfile } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', senderId)
    .maybeSingle()

  await notifyMessageReceived(db, {
    recipientId,
    senderName: senderProfile?.full_name || 'Someone',
    preview: previewText,
  })

  return {
    message,
    senderRole,
    recipientId,
    conversation,
  }
}

export async function markConversationRead(db, conversationId, userId) {
  const { data: conversation, error } = await db
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (error) throw error
  const canAccess = await userCanAccessConversation(db, userId, conversation)
  if (!canAccess) throw new Error('Forbidden')

  const artistId = await getArtistIdForProfile(db, userId)
  const viewerIsArtist = artistId != null && conversation.artist_id === artistId
  const alreadyRead = viewerIsArtist
    ? (conversation.artist_unread ?? 0) === 0
    : (conversation.employer_unread ?? 0) === 0

  const { data: messages, error: msgError } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgError) throw msgError

  if (alreadyRead) {
    return mapConversationToClient(conversation, messages || [], { viewerIsArtist })
  }

  const now = new Date().toISOString()
  const patch = viewerIsArtist
    ? { artist_unread: 0, artist_last_read_at: now }
    : { employer_unread: 0, employer_last_read_at: now }

  const { data: updated, error: updateError } = await db
    .from('conversations')
    .update(patch)
    .eq('id', conversationId)
    .select(`
      *,
      artist:artists(id, display_name, profile_id)
    `)
    .single()

  if (updateError) throw updateError

  return mapConversationToClient(updated, messages || [], { viewerIsArtist })
}

export { formatMessageTime, mapMessageToThread }
