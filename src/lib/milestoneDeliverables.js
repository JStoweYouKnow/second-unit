import { supabase, isSupabaseConfigured } from './supabase'

const BUCKET = 'milestone-deliverables'
const MAX_BYTES = 50 * 1024 * 1024

function sanitizeFilename(name) {
  return (name || 'deliverable')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

/**
 * Upload optional milestone work product.
 * Path: {contractId}/{milestoneId}/{timestamp}-{filename}
 */
export async function uploadMilestoneDeliverable(contractId, milestoneId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  if (!contractId || !milestoneId || !file) {
    throw new Error('Contract, milestone, and file required')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Deliverable file must be 50MB or smaller')
  }

  const path = `${contractId}/${milestoneId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) throw error
  return path
}

export async function getMilestoneDeliverableSignedUrl(storagePath, expiresIn = 3600) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error) throw error
  return data?.signedUrl ?? null
}

export async function downloadMilestoneDeliverable(storagePath, filename) {
  const url = await getMilestoneDeliverableSignedUrl(storagePath)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'deliverable'
  a.rel = 'noopener'
  a.target = '_blank'
  a.click()
}
