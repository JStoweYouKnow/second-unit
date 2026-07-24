import { createClient } from '@supabase/supabase-js'
import { requireServiceRoleInProduction } from './env.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const isPlaceholder = (value) =>
  !value ||
  value === 'your-project-url-here' ||
  value === 'your-anon-key-here' ||
  value === 'your-service-role-key-here'

function resolveServerKey() {
  if (!isPlaceholder(serviceRoleKey)) return { key: serviceRoleKey, usingServiceRole: true }

  // Production must not fall back to the anon key (bypasses intended server privileges / RLS assumptions).
  if (requireServiceRoleInProduction()) {
    console.error(
      '[db] SUPABASE_SERVICE_ROLE_KEY is required in production. Refusing anon-key fallback.',
    )
    return { key: null, usingServiceRole: false }
  }

  if (!isPlaceholder(anonKey)) {
    console.warn(
      '[db] Using anon key for server db client. Set SUPABASE_SERVICE_ROLE_KEY for production.',
    )
    return { key: anonKey, usingServiceRole: false }
  }

  return { key: null, usingServiceRole: false }
}

const { key: supabaseKey, usingServiceRole } = resolveServerKey()

export const dbUsesServiceRole = usingServiceRole

export const db =
  !isPlaceholder(supabaseUrl) && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null
