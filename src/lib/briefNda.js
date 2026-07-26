import { supabase, isSupabaseConfigured } from './supabase'

const BUCKET = 'brief-nda'
export const MAX_BRIEF_NDA_BYTES = 15 * 1024 * 1024

export function isAllowedBriefNdaFile(file) {
  if (!file?.name) return false
  if (/\.(pdf|doc|docx)$/i.test(file.name)) return true
  const mime = (file.type || '').toLowerCase()
  return (
    mime === 'application/pdf' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}

function sanitizeFilename(name) {
  return (name || 'nda')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export async function uploadBriefNda(briefId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  if (!briefId || !file) throw new Error('Brief and file required')

  const path = `${briefId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) throw error
  return path
}

export async function getBriefNdaSignedUrl(storagePath, expiresIn = 3600) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) throw error
  return data?.signedUrl ?? null
}

export async function downloadBriefNda(storagePath, filename) {
  const url = await getBriefNdaSignedUrl(storagePath)
  if (!url) return

  const response = await fetch(url)
  if (!response.ok) throw new Error('Download failed')

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename || 'nda'
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(blobUrl)
}
