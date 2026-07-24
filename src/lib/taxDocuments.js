import { supabase, isSupabaseConfigured } from './supabase'

const BUCKET = 'employer-tax-docs'
const MAX_BYTES = 15 * 1024 * 1024

function sanitizeFilename(name) {
  return (name || 'tax-doc')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

/**
 * Upload a private tax document for the signed-in hirer.
 * Path: {userId}/{timestamp}-{filename}
 */
export async function uploadTaxDocument(userId, file, { docType = 'other', notes = '' } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Storage requires Supabase configuration')
  }
  if (!userId || !file) throw new Error('User and file required')
  if (file.size > MAX_BYTES) throw new Error('File must be 15MB or smaller')

  const path = `${userId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('tax_documents')
    .insert({
      owner_id: userId,
      doc_type: docType,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      notes: notes || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listTaxDocuments(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return []
  const { data, error } = await supabase
    .from('tax_documents')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTaxDocumentSignedUrl(storagePath, expiresIn = 3600) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data?.signedUrl ?? null
}

export async function deleteTaxDocument(userId, doc) {
  if (!isSupabaseConfigured || !supabase || !doc?.id) return
  if (doc.storage_path) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path])
  }
  const { error } = await supabase
    .from('tax_documents')
    .delete()
    .eq('id', doc.id)
    .eq('owner_id', userId)
  if (error) throw error
}
