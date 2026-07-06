import { supabase, isSupabaseConfigured } from './supabase'

const BUCKET = 'portfolio-media'
const MAX_BYTES = 50 * 1024 * 1024

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

function sanitizeFilename(name) {
  return (name || 'media')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export function isPortfolioMediaFile(file) {
  return file && ALLOWED.has(file.type) && file.size <= MAX_BYTES
}

/**
 * Upload portfolio image/video to Supabase Storage (public bucket).
 * @param {string} artistId
 * @param {File} file
 */
export async function uploadPortfolioMedia(artistId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  if (!artistId || !file) throw new Error('Artist and file required')
  if (!isPortfolioMediaFile(file)) {
    throw new Error('Use JPG, PNG, WebP, GIF, MP4, WebM, or MOV up to 50MB')
  }

  const path = `${artistId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '86400',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
  return { storagePath: path, mediaUrl: data.publicUrl, mediaType }
}

export async function deletePortfolioStoragePath(storagePath) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return
  await supabase.storage.from(BUCKET).remove([storagePath])
}
