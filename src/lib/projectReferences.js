import { supabase, isSupabaseConfigured } from './supabase'
import { SENSITIVE_SIGNED_URL_TTL } from './sensitiveStorage'

const BUCKET = 'project-references'
export const MAX_PROJECT_REFERENCE_BYTES = 50 * 1024 * 1024

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
  'video/quicktime',
  'text/plain',
])

function sanitizeFilename(name) {
  return (name || 'reference')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

export function isAllowedProjectReferenceFile(file) {
  if (!file) return false
  const type = (file.type || '').toLowerCase()
  if (ALLOWED_TYPES.has(type)) return true
  const ext = (file.name || '').split('.').pop()?.toLowerCase()
  return ['pdf', 'doc', 'docx', 'zip', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'txt'].includes(ext || '')
}

export async function uploadProjectReference(contractId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  if (!contractId || !file) throw new Error('Contract and file required')
  if (file.size > MAX_PROJECT_REFERENCE_BYTES) {
    throw new Error('Reference file must be 50MB or smaller')
  }
  if (!isAllowedProjectReferenceFile(file)) {
    throw new Error('File type not allowed for reference materials')
  }

  const path = `${contractId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

export async function getProjectReferenceSignedUrl(storagePath, expiresIn = SENSITIVE_SIGNED_URL_TTL) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data?.signedUrl ?? null
}

export async function downloadProjectReference(storagePath, filename) {
  const url = await getProjectReferenceSignedUrl(storagePath)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'reference'
  a.rel = 'noopener'
  a.target = '_blank'
  a.click()
}
