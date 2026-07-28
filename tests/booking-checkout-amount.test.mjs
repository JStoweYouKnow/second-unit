import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bookingAmountDollars,
  resolveBookingCharge,
  BookingCheckoutError,
} from '../api/_lib/bookingCheckout.js'
import { completeBookingPayment } from '../api/_lib/completeBookingPayment.js'
import { claimStripeEvent } from '../api/_lib/stripeEvents.js'

const HIRER = 'user_hirer'
const OTHER = 'user_other'

function bookingRow(overrides = {}) {
  return {
    id: 'bk_1',
    employer_id: HIRER,
    artist_id: 'art_1',
    status: 'confirmed',
    agreed_total: 10000,
    rate: 1250,
    duration_hours: 8,
    duration_unit: 'hours',
    booking_type: 'Shoot',
    date: '2026-08-01',
    ...overrides,
  }
}

/** Minimal thenable Supabase stub returning one booking row. */
function mockDb(booking, { fetchError = null } = {}) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: () =>
                  Promise.resolve({ data: booking, error: fetchError }),
              }
            },
          }
        },
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Amount derivation
// ---------------------------------------------------------------------------

test('bookingAmountDollars prefers agreed_total', () => {
  assert.equal(bookingAmountDollars(bookingRow()), 10000)
})

test('bookingAmountDollars falls back to rate x duration, matching bookingSubtotal', () => {
  const row = bookingRow({ agreed_total: null, rate: 250, duration_hours: 6 })
  assert.equal(bookingAmountDollars(row), 1500)
})

test('bookingAmountDollars treats a project block as a flat rate', () => {
  const row = bookingRow({
    agreed_total: null,
    rate: 5000,
    duration_hours: 1,
    duration_unit: 'project',
  })
  assert.equal(bookingAmountDollars(row), 5000)
})

test('bookingAmountDollars rejects a booking with nothing to charge', () => {
  assert.throws(
    () => bookingAmountDollars(bookingRow({ agreed_total: 0, rate: 0, duration_hours: 0 })),
    /no valid agreed total/i,
  )
})

// ---------------------------------------------------------------------------
// Ownership + state — the checkout entry points must fail closed
// ---------------------------------------------------------------------------

test('resolveBookingCharge returns the server-derived amount for the hirer', async () => {
  const { booking, amountDollars } = await resolveBookingCharge(mockDb(bookingRow()), 'bk_1', HIRER)
  assert.equal(booking.id, 'bk_1')
  assert.equal(amountDollars, 10000)
})

test('resolveBookingCharge refuses a booking belonging to someone else', async () => {
  await assert.rejects(
    () => resolveBookingCharge(mockDb(bookingRow()), 'bk_1', OTHER),
    (err) => err instanceof BookingCheckoutError && err.status === 403,
  )
})

test('resolveBookingCharge 404s instead of failing open on a missing booking', async () => {
  // Regression: the old handler passed through when the lookup returned null.
  await assert.rejects(
    () => resolveBookingCharge(mockDb(null), 'bk_missing', HIRER),
    (err) => err instanceof BookingCheckoutError && err.status === 404,
  )
})

test('resolveBookingCharge requires a booking id', async () => {
  await assert.rejects(
    () => resolveBookingCharge(mockDb(bookingRow()), null, HIRER),
    (err) => err instanceof BookingCheckoutError && err.status === 400,
  )
})

test('resolveBookingCharge refuses to charge an already-paid booking', async () => {
  for (const status of ['paid', 'completed']) {
    await assert.rejects(
      () => resolveBookingCharge(mockDb(bookingRow({ status })), 'bk_1', HIRER),
      /already been paid/i,
    )
  }
})

test('resolveBookingCharge refuses a cancelled booking', async () => {
  await assert.rejects(
    () => resolveBookingCharge(mockDb(bookingRow({ status: 'cancelled' })), 'bk_1', HIRER),
    /cannot be paid/i,
  )
})

// ---------------------------------------------------------------------------
// Captured-amount reconciliation — the underpayment attack
// ---------------------------------------------------------------------------

test('completeBookingPayment refuses when Stripe captured less than the booking total', async () => {
  // The attack: create a $10,000 booking, check out for $0.50, and let the
  // webhook mark it paid at full value.
  const result = await completeBookingPayment(mockDb(bookingRow()), 'bk_1', {
    paymentIntentId: 'pi_underpaid',
    capturedAmountCents: 50,
  })

  assert.ok(result.error, 'must not record a payment for an underpaid booking')
  assert.match(result.error, /does not match booking total/i)
})

test('completeBookingPayment reports missing bookings as an error, not silence', async () => {
  // The webhook now surfaces this so Stripe retries rather than dropping it.
  const result = await completeBookingPayment(mockDb(null), 'bk_missing', {
    capturedAmountCents: 1000000,
  })
  assert.match(result.error, /not found/i)
})

// ---------------------------------------------------------------------------
// Webhook idempotency
// ---------------------------------------------------------------------------

test('claimStripeEvent claims once and rejects the duplicate delivery', async () => {
  const seen = new Set()
  const db = {
    from() {
      return {
        insert(row) {
          if (seen.has(row.id)) {
            return Promise.resolve({ error: { code: '23505', message: 'duplicate key value' } })
          }
          seen.add(row.id)
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  const event = { id: 'evt_1', type: 'checkout.session.completed' }
  // A Checkout session delivers both checkout.session.completed and
  // payment_intent.succeeded; only the first may do the work.
  assert.equal((await claimStripeEvent(db, event)).claimed, true)
  assert.equal((await claimStripeEvent(db, event)).claimed, false)
})

test('claimStripeEvent still processes when the ledger table is absent', async () => {
  // A missing migration must not block live payments.
  const db = {
    from() {
      return {
        insert: () =>
          Promise.resolve({
            error: { code: '42P01', message: 'relation "stripe_webhook_events" does not exist' },
          }),
      }
    },
  }
  assert.equal((await claimStripeEvent(db, { id: 'evt_2', type: 'x' })).claimed, true)
})
