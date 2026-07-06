import { supabase, isSupabaseConfigured } from './supabase'

const BUCKET = 'dispute-evidence'

function sanitizeFilename(name) {
  return (name || 'evidence').replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
}

export async function uploadDisputeEvidence(disputeId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  const path = `${disputeId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}
