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

function resolveAuthKey() {
  // getUser(jwt) works with anon or service role; prefer service role in prod.
  if (!isPlaceholder(serviceRoleKey)) return serviceRoleKey
  if (requireServiceRoleInProduction()) return null
  if (!isPlaceholder(anonKey)) return anonKey
  return null
}

const supabaseKey = resolveAuthKey()

const supabase =
  !isPlaceholder(supabaseUrl) && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null

export async function requireAuth(req, res) {
  if (!supabase) {
    res.status(503).json({
      error:
        'Server misconfigured: set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (required in production)',
    })
    return null
  }
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const token = auth.slice(7)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
  return user
}
