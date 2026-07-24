#!/usr/bin/env node
/**
 * Recover a private-invite application that failed on confirmation email.
 *
 * Usage:
 *   node scripts/recover-invite-application.mjs \
 *     --email=artist@example.com \
 *     --password='TempPass123!' \
 *     --token=INVITE_TOKEN \
 *     --name='Artist Name'
 *
 * Loads .env.local. Marks invite used and creates a pending application.
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { applyWithArtistInvite } from '../api/_lib/inviteApply.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const email = arg('email')
const password = arg('password')
const token = arg('token')
const name = arg('name', email.split('@')[0] || 'Artist')

if (!email || !password || !token) {
  console.error('Required: --email= --password= --token=  optional: --name=')
  process.exit(2)
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

try {
  const result = await applyWithArtistInvite(db, {
    inviteToken: token,
    email,
    password,
    form: {
      fullName: name,
      roleTitle: 'Artist',
      bio: '',
      location: '',
      skills: '',
      brands: '',
    },
  })
  console.log('Recovered application:')
  console.log(JSON.stringify(result, null, 2))
  console.log('\nArtist can sign in with that email/password. Check Admin → Applications.')
} catch (err) {
  console.error('Recovery failed:', err.message)
  process.exit(1)
}
