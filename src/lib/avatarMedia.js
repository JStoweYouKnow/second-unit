import { supabase, isSupabaseConfigured } from './supabase'

const BUCKET = 'avatars'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function sanitizeFilename(name) {
  return (name || 'avatar')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

/**
 * Upload a profile avatar and return its public URL + storage path.
 * @param {string} userId profiles.id / auth.uid()
 * @param {File} file
 */
export async function uploadAvatar(userId, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Avatar upload requires Supabase configuration')
  }
  if (!userId || !file) throw new Error('User and file required')
  if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) {
    throw new Error('Use JPG, PNG, WebP, or GIF up to 5MB')
  }

  const path = `${userId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '86400',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    const msg = error.message || String(error)
    if (/bucket not found|not found/i.test(msg)) {
      throw new Error(
        'Avatar storage is not set up yet. In the Supabase SQL Editor, run supabase/avatars-storage.sql, then try again.'
      )
    }
    throw new Error(msg)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { storagePath: path, mediaUrl: data.publicUrl }
}

export async function deleteAvatarStoragePath(storagePath) {
  if (!isSupabaseConfigured || !supabase || !storagePath) return
  await supabase.storage.from(BUCKET).remove([storagePath])
}
