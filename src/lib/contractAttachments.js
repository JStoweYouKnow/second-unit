import { supabase, isSupabaseConfigured } from './supabase'

const BUCKET = 'contract-attachments'

function sanitizeFilename(name) {
  return (name || 'agreement')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

/**
 * Upload a custom agreement file to Supabase Storage.
 * @param {string} contractId
 * @param {File} file
 */
export async function uploadContractAttachment(contractId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  if (!contractId || !file) throw new Error('Contract and file required')

  const path = `${contractId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) throw error
  return path
}

/**
 * Create a short-lived signed download URL for a stored attachment.
 * @param {string} storagePath
 * @param {number} expiresIn seconds
 */
export async function getContractAttachmentSignedUrl(storagePath, expiresIn = 3600) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) throw error
  return data?.signedUrl ?? null
}

export async function downloadContractAttachment(storagePath, filename) {
  const url = await getContractAttachmentSignedUrl(storagePath)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'agreement'
  a.rel = 'noopener'
  a.target = '_blank'
  a.click()
}
