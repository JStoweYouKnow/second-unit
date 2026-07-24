import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireStripeConfigured } from '../api/_lib/stripe.js'
import { assertCheckoutSessionPayable } from '../api/_lib/confirmCheckout.js'
import { buildArtistTransferParams } from '../api/_lib/artistTransfer.js'
import {
  assertReleaseHasTransferId,
  executeDisputePayouts,
} from '../api/_lib/disputePayouts.js'
import {
  REQUIRED_MIGRATIONS,
  TRACKING_MIGRATION,
} from '../api/_lib/migrationManifest.js'

/** Minimal thenable Supabase query builder for findPaymentsForDispute. */
function mockDbForDisputePayments(payments) {
  const updates = []
  const selectChain = {
    select() {
      return selectChain
    },
    eq() {
      return selectChain
    },
    order() {
      return selectChain
    },
    then(resolve, reject) {
      return Promise.resolve({ data: payments, error: null }).then(resolve, reject)
    },
  }
  return {
    updates,
    db: {
      from(table) {
        return {
          select() {
            return selectChain
          },
          update(payload) {
            return {
              eq(_col, id) {
                updates.push({ table, payload, id })
                return Promise.resolve({ error: null })
              },
              in() {
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      },
    },
  }
}

test('requireStripeConfigured fails closed when Stripe is unset', () => {
  const check = requireStripeConfigured()
  assert.ok(typeof check.ok === 'boolean')
  if (!check.ok) {
    assert.equal(check.status, 503)
    assert.match(check.error, /Stripe is not configured/i)
  }
})

test('assertCheckoutSessionPayable rejects unpaid sessions', () => {
  assert.throws(
    () => assertCheckoutSessionPayable({ payment_status: 'unpaid', status: 'open' }),
    /not paid/i,
  )
  assert.throws(() => assertCheckoutSessionPayable(null), /not found/i)
  assert.doesNotThrow(() =>
    assertCheckoutSessionPayable({ payment_status: 'paid', status: 'complete' }),
  )
  assert.doesNotThrow(() =>
    assertCheckoutSessionPayable({ payment_status: 'unpaid', status: 'complete' }),
  )
})

test('buildArtistTransferParams requires Connect destination and includes source_transaction', () => {
  assert.throws(
    () =>
      buildArtistTransferParams({
        payment: { id: 'pay_1', artist_payout_amount: 850 },
        destination: null,
      }),
    /Connect/i,
  )

  const withCharge = buildArtistTransferParams({
    payment: { id: 'pay_1', artist_payout_amount: 850 },
    destination: 'acct_artist',
    transferGroup: 'ms_1',
    metadata: { milestoneId: 'ms_1' },
    chargeId: 'ch_123',
  })
  assert.equal(withCharge.amount, 850)
  assert.equal(withCharge.destination, 'acct_artist')
  assert.equal(withCharge.source_transaction, 'ch_123')
  assert.equal(withCharge.transfer_group, 'ms_1')
  assert.equal(withCharge.metadata.paymentId, 'pay_1')

  const withoutCharge = buildArtistTransferParams({
    payment: { id: 'pay_2', artist_payout_amount: 100 },
    destination: 'acct_artist',
  })
  assert.equal(withoutCharge.source_transaction, undefined)
})

test('assertReleaseHasTransferId fails closed without transfer id', () => {
  assert.throws(() => assertReleaseHasTransferId(null), /transfer_id/i)
  assert.throws(() => assertReleaseHasTransferId(undefined), /transfer_id/i)
  assert.throws(() => assertReleaseHasTransferId(''), /transfer_id/i)
  assert.doesNotThrow(() => assertReleaseHasTransferId('tr_123'))
})

test('dispute release_artist does not mock-release when Connect is missing', async () => {
  const payment = {
    id: 'pay_dispute_1',
    status: 'paid',
    payout_status: 'pending',
    amount: 1000,
    artist_payout_amount: 850,
    stripe_payment_intent_id: 'pi_test',
    artist_stripe_account_id: null,
    milestone_id: 'ms_1',
  }
  const { db, updates } = mockDbForDisputePayments([payment])

  const result = await executeDisputePayouts(db, { milestone_id: 'ms_1' }, {
    outcome: 'release_artist',
  })

  assert.equal(result.actions.length, 0)
  assert.ok(result.errors.some((e) => /no_stripe_connect/i.test(e)))
  assert.ok(
    !updates.some((u) => u.payload?.payout_status === 'paid'),
    'must not mark payout_status paid without a transfer',
  )
})

test('migration manifest lists tracking + payments files for money readiness', () => {
  assert.equal(REQUIRED_MIGRATIONS[0], TRACKING_MIGRATION)
  assert.ok(REQUIRED_MIGRATIONS.includes('payments-escrow.sql'))
  assert.ok(REQUIRED_MIGRATIONS.includes('milestone-deliverables.sql'))
  assert.ok(REQUIRED_MIGRATIONS.includes('dispute-payouts-migration.sql'))
})
