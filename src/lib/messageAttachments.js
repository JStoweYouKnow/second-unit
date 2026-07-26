import { supabase, isSupabaseConfigured } from './supabase'
import { SENSITIVE_SIGNED_URL_TTL } from './sensitiveStorage'

const BUCKET = 'message-attachments'
export const MAX_MESSAGE_ATTACHMENT_BYTES = 25 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'text/plain',
])

function sanitizeFilename(name) {
  return (name || 'attachment')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export function isAllowedMessageAttachmentFile(file) {
  if (!file) return false
  const type = (file.type || '').toLowerCase()
  if (ALLOWED_TYPES.has(type)) return true
  const ext = (file.name || '').split('.').pop()?.toLowerCase()
  return ['pdf', 'doc', 'docx', 'zip', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'txt'].includes(ext || '')
}

export async function uploadMessageAttachment(conversationId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  if (!conversationId || !file) throw new Error('Conversation and file required')
  if (file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
    throw new Error('Attachment must be 25MB or smaller')
  }
  if (!isAllowedMessageAttachmentFile(file)) {
    throw new Error('File type not allowed for message attachments')
  }

  const path = `${conversationId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

export async function getMessageAttachmentSignedUrl(storagePath, expiresIn = SENSITIVE_SIGNED_URL_TTL) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data?.signedUrl ?? null
}

export async function downloadMessageAttachment(storagePath, filename) {
  const url = await getMessageAttachmentSignedUrl(storagePath)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'attachment'
  a.rel = 'noopener'
  a.target = '_blank'
  a.click()
}
