#!/usr/bin/env node
/**
 * Backfill linked contracts for confirmed bookings that pre-date auto-linking.
 * Usage: node scripts/backfill-booking-contracts.mjs
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { ensureContractForBooking } from '../api/_lib/bookingContract.js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(url, key)

const { data: bookings, error } = await db
  .from('bookings')
  .select('*')
  .eq('status', 'confirmed')
  .is('contract_id', null)

if (error) {
  console.error(error.message)
  process.exit(1)
}

let created = 0
let skipped = 0

for (const booking of bookings || []) {
  try {
    const contract = await ensureContractForBooking(db, booking)
    if (contract) {
      created += 1
      console.log(`✓ ${booking.id} → contract ${contract.id}`)
    } else {
      skipped += 1
    }
  } catch (err) {
    console.error(`✗ ${booking.id}:`, err.message)
  }
}

console.log(`Done. Created/linked: ${created}, skipped: ${skipped}`)
