#!/usr/bin/env node
/**
 * Smoke-test hirer → platform → artist payment plumbing.
 * Usage: node scripts/test-stripe-payment-flow.mjs
 * Loads .env.local then .env if present (never prints secrets).
 */
import 'dotenv/config'
import { config } from 'dotenv'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  platformFeeAmountCents,
  artistPayoutAmountCents,
} from '../api/_lib/fees.js'
import { completeBookingPayment } from '../api/_lib/completeBookingPayment.js'

config({ path: '.env.local', override: true })

const results = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

function section(title) {
  console.log(`\n── ${title} ──`)
}

// ── 1. Fee split math ──
section('Fee split (15% platform / 85% artist)')
{
  const amount = 250000 // $2,500.00
  const fee = platformFeeAmountCents(amount)
  const payout = artistPayoutAmountCents(amount)
  if (fee === 37500 && payout === 212500 && fee + payout === amount) {
    pass('Fee split on $2,500 booking', `fee=$${fee / 100}, payout=$${payout / 100}`)
  } else {
    fail('Fee split', `got fee=${fee}, payout=${payout}`)
  }
}

// ── 2. Production health ──
section('Production API health')
{
  try {
    const res = await fetch('https://www.thecallsheet.ai/api/health')
    const data = await res.json()
    if (res.ok && data.stripe && data.supabase) {
      pass('Production /api/health', `mode=${data.mode}`)
    } else {
      fail('Production /api/health', JSON.stringify(data))
    }
  } catch (err) {
    fail('Production /api/health', err.message)
  }
}

// ── 3. Stripe credentials ──
section('Stripe API')
const stripeKey = process.env.STRIPE_SECRET_KEY
let stripe = null
if (!stripeKey) {
  fail('STRIPE_SECRET_KEY configured')
} else {
  pass('STRIPE_SECRET_KEY present', stripeKey.startsWith('sk_') || stripeKey.startsWith('rk_') ? 'key loaded' : 'unusual prefix')
  stripe = new Stripe(stripeKey)
  try {
    const balance = await stripe.balance.retrieve()
    const available = balance.available?.[0]
    pass('Stripe balance.retrieve', available ? `${available.currency} ${available.amount}` : 'ok')
  } catch (err) {
    fail('Stripe balance.retrieve', err.message)
  }
}

// ── 4. Checkout session shape (no charge — session only) ──
section('Stripe Checkout session creation')
if (stripe) {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Callsheet payment flow test (do not pay)' },
          unit_amount: 100,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        metadata: { bookingId: 'test-booking-id', test: 'true' },
      },
      metadata: { bookingId: 'test-booking-id', test: 'true' },
      success_url: 'https://www.thecallsheet.ai/bookings?payment_success=1&test=1',
      cancel_url: 'https://www.thecallsheet.ai/bookings?payment_cancelled=1&test=1',
    })
    if (session.url && session.id) {
      pass('Checkout session created', `id=${session.id}`)
      // Expire immediately so it cannot be paid accidentally
      await stripe.checkout.sessions.expire(session.id).catch(() => {})
      pass('Checkout session expired (test cleanup)')
    } else {
      fail('Checkout session', 'missing url or id')
    }
  } catch (err) {
    fail('Checkout session creation', err.message)
  }
}

// ── 5. Webhook secret ──
section('Webhook config')
if (process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
  pass('STRIPE_WEBHOOK_SECRET present')
} else {
  fail('STRIPE_WEBHOOK_SECRET', 'missing or invalid prefix')
}

// ── 6. Supabase + payment records (optional) ──
section('Supabase payment pipeline')
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.log('  (skipped — set VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to inspect live rows)')
} else {
  const db = createClient(supabaseUrl, serviceKey)
  pass('Supabase client initialized')

  const { data: bookings, error: bErr } = await db
    .from('bookings')
    .select('id, status, agreed_total, employer_id, artist_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (bErr) {
    fail('Recent bookings query', bErr.message)
  } else {
    pass('Recent bookings', `${bookings?.length ?? 0} rows`)
    for (const b of bookings || []) {
      console.log(`    · ${b.id.slice(0, 8)}… status=${b.status} total=$${b.agreed_total}`)
    }
  }

  const { data: payments, error: pErr } = await db
    .from('payments')
    .select('id, status, payout_status, amount, platform_fee_amount, artist_payout_amount, booking_id, milestone_id, transfer_id')
    .order('created_at', { ascending: false })
    .limit(5)

  if (pErr) {
    fail('Recent payments query', pErr.message)
  } else {
    pass('Recent payments', `${payments?.length ?? 0} rows`)
    for (const p of payments || []) {
      const dollars = (p.amount / 100).toFixed(2)
      console.log(
        `    · ${p.id.slice(0, 8)}… $${dollars} status=${p.status} payout=${p.payout_status}${p.transfer_id ? ' transfer=' + p.transfer_id.slice(0, 10) + '…' : ''}`
      )
    }
  }

  const { data: artists, error: aErr } = await db
    .from('artists')
    .select('id, display_name, stripe_account_id')
    .not('stripe_account_id', 'is', null)
    .limit(3)

  if (aErr) {
    fail('Artists with Connect accounts', aErr.message)
  } else {
    pass('Artists with Stripe Connect', `${artists?.length ?? 0} found`)
    if (stripe) {
      for (const a of artists || []) {
        try {
          const acct = await stripe.accounts.retrieve(a.stripe_account_id)
          const ready = acct.charges_enabled && acct.payouts_enabled
          console.log(`    · ${a.display_name}: payouts_enabled=${!!acct.payouts_enabled}${ready ? ' (ready)' : ' (onboarding incomplete)'}`)
        } catch (err) {
          console.log(`    · ${a.display_name}: account lookup failed — ${err.message}`)
        }
      }
    }
  }
}

// ── 7. Auth-gated endpoints return JSON ──
section('API auth gates')
for (const path of ['/api/bookings', '/api/payments/create-checkout']) {
  try {
    const res = await fetch(`https://www.thecallsheet.ai${path}`, {
      method: path.includes('checkout') ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: path.includes('checkout') ? JSON.stringify({ amount: 1, bookingId: 'test' }) : undefined,
    })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    if (isJson && res.status === 401) {
      pass(`${path} returns 401 JSON`)
    } else {
      fail(`${path} auth gate`, `status=${res.status} json=${isJson}`)
    }
  } catch (err) {
    fail(path, err.message)
  }
}

// ── Summary ──
section('Summary')
const failed = results.filter((r) => !r.ok)
if (failed.length === 0) {
  console.log('\nAll automated checks passed.')
  console.log('\nManual E2E (requires hirer + artist accounts):')
  console.log('  1. Hirer: Bookings → New Booking → pick artist, set fee, submit')
  console.log('  2. Artist: Bookings → Confirm')
  console.log('  3. Hirer: Bookings → Pay → Stripe Checkout (4242 4242 4242 4242 in test mode)')
  console.log('  4. Webhook marks booking paid; verify on Payments tab')
  console.log('  5. Hirer: Mark complete → 85% transfers to artist Connect account')
  console.log('  Or via Projects: sign contract → pay milestone 1 → approve → artist receives payout')
  process.exit(0)
} else {
  console.log(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}
