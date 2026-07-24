#!/usr/bin/env node
/**
 * Record that a SQL file was applied:
 *   npm run record:migration -- payments-escrow.sql
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { ALL_TRACKED_MIGRATIONS } from '../api/_lib/migrationManifest.js'

const filename = process.argv[2]?.replace(/^supabase\//, '')
if (!filename) {
  console.error('Usage: npm run record:migration -- <filename.sql>')
  process.exit(2)
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const notes = process.argv.includes('--notes')
  ? process.argv[process.argv.indexOf('--notes') + 1]
  : ALL_TRACKED_MIGRATIONS.includes(filename)
    ? null
    : 'ad-hoc / not in manifest'

const db = createClient(url, key)
const { error } = await db.from('schema_migrations').upsert(
  { filename, notes, applied_at: new Date().toISOString() },
  { onConflict: 'filename' },
)

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log(`Recorded: ${filename}`)
