import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

export const db =
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'your-project-url-here' &&
  supabaseKey !== 'your-anon-key-here'
    ? createClient(supabaseUrl, supabaseKey)
    : null
