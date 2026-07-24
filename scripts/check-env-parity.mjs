#!/usr/bin/env node
/**
 * List required env vars for Vercel (production API) vs local Express.
 * Does not print secret values.
 *
 *   npm run check:env
 */
import dotenv from 'dotenv'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })
dotenv.config()

const REQUIRED_BOTH = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FRONTEND_URL',
]

const OPTIONAL = [
  'VITE_PRODUCTION_URL',
  'VITE_SITE_URL',
  'VITE_API_URL',
  'SENTRY_DSN',
  'VITE_SENTRY_DSN',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'GOOGLE_CALENDAR_CLIENT_ID',
  'GOOGLE_CALENDAR_CLIENT_SECRET',
]

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const local = {
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.local'),
  ...process.env,
}

console.log('Dual-runtime env check')
console.log('======================')
console.log('Production API: Vercel serverless (/api/*)')
console.log('Local API:      Express (npm run dev:server) — optional Socket.io host')
console.log('Keep the same secrets on Vercel Production (and Railway if still used).\n')

let missing = 0
for (const key of REQUIRED_BOTH) {
  const present = !!(local[key] && local[key] !== 'your-service-role-key-here')
  console.log(`${present ? '✓' : '✗'} ${key}${present ? '' : '  (missing locally)'}`)
  if (!present) missing += 1
}

console.log('\nOptional:')
for (const key of OPTIONAL) {
  const present = !!local[key]
  console.log(`${present ? '·' : ' '} ${key}${present ? '' : '  (unset)'}`)
}

const fe = local.FRONTEND_URL || ''
console.log('\nFRONTEND_URL guidance:')
if (/localhost|127\.0\.0\.1/i.test(fe)) {
  console.log(`  Local file has ${fe} — correct for Express/Vite local dev.`)
  console.log('  On Vercel Production set: https://www.thecallsheet.ai')
} else if (/thecallsheet\.ai/i.test(fe)) {
  console.log(`  Local file has ${fe} — fine for prod-like redirects; use localhost:5173 for local Stripe return URLs.`)
} else {
  console.log(`  Current: ${fe || '(empty)'} — set per environment (see above).`)
}

if (missing) {
  console.error(`\n${missing} required var(s) missing locally.`)
  process.exit(1)
}
console.log('\nLocal required vars look present.')
process.exit(0)
