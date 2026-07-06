import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Env present but createClient failed → treat as mock mode so the app still boots
const envLooksConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-project-url-here'
)

function createSupabaseClient() {
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  } catch (err) {
    console.error('Supabase createClient failed — check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY', err)
    return null
  }
}

export const supabase = envLooksConfigured ? createSupabaseClient() : null
/** True only when we have a live client (avoids auth calling `supabase.auth` on null). */
export const isSupabaseConfigured = Boolean(supabase)

/** Fallback if signOut RPC hangs or fails — clears persisted Supabase auth keys. */
export function clearPersistedAuthSession() {
  if (typeof window === 'undefined') return
  const storages = [window.localStorage, window.sessionStorage]
  for (const storage of storages) {
    for (const key of [...Object.keys(storage)]) {
      if (/^sb-.*-auth-token/.test(key)) {
        storage.removeItem(key)
      }
    }
  }
}
