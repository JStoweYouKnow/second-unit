#!/usr/bin/env node
/**
 * Compare applied rows in public.schema_migrations against the repo manifest.
 *
 * Usage:
 *   npm run verify:migrations
 *   npm run verify:migrations -- --required-only
 *
 * Requires VITE_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  ALL_TRACKED_MIGRATIONS,
  REQUIRED_MIGRATIONS,
} from '../api/_lib/migrationManifest.js'

const requiredOnly = process.argv.includes('--required-only')
const expected = requiredOnly ? REQUIRED_MIGRATIONS : ALL_TRACKED_MIGRATIONS

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key || key === 'your-service-role-key-here') {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const db = createClient(url, key)
const { data, error } = await db.from('schema_migrations').select('filename, applied_at')

if (error) {
  console.error('Could not read schema_migrations:', error.message)
  console.error('Apply supabase/schema-migrations.sql first, then re-run.')
  process.exit(2)
}

const applied = new Set((data || []).map((r) => r.filename))
const missing = expected.filter((f) => !applied.has(f))
const extra = [...applied].filter((f) => !expected.includes(f))

console.log(`Expected (${requiredOnly ? 'required only' : 'all tracked'}): ${expected.length}`)
console.log(`Applied: ${applied.size}`)

if (missing.length) {
  console.error('\nMissing migrations:')
  for (const f of missing) console.error(`  - ${f}`)
}

if (extra.length) {
  console.warn('\nApplied but not in manifest (ok if ad-hoc fixes):')
  for (const f of extra) console.warn(`  - ${f}`)
}

if (missing.length) {
  console.error('\nVerify failed.')
  process.exit(1)
}

console.log('\nAll expected migrations are recorded.')
process.exit(0)
