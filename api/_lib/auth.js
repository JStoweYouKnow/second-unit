import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

const supabase =
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'your-project-url-here' &&
  supabaseKey !== 'your-anon-key-here' &&
  supabaseKey !== 'your-service-role-key-here'
    ? createClient(supabaseUrl, supabaseKey)
    : null

export async function requireAuth(req, res) {
  if (!supabase) {
    res.status(503).json({
      error: 'Server misconfigured: set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)',
    })
    return null
  }
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const token = auth.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
  return user
}
