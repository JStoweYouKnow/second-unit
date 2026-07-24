import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  platformFeeAmountCents,
  artistPayoutAmountCents,
  PLATFORM_FEE_PERCENT,
} from '../api/_lib/fees.js'
import {
  platformFeeAmount,
  artistPayoutAmount,
  artistReleasedAmount,
  artistEscrowAmount,
} from '../src/lib/fees.js'

test('fee split sums to booking amount in cents', () => {
  const amount = 250000
  const fee = platformFeeAmountCents(amount)
  const payout = artistPayoutAmountCents(amount)
  assert.equal(fee, 37500)
  assert.equal(payout, 212500)
  assert.equal(fee + payout, amount)
  assert.equal(PLATFORM_FEE_PERCENT, 15)
})

test('client fee helpers match dollar split', () => {
  assert.equal(platformFeeAmount(100), 15)
  assert.equal(artistPayoutAmount(100), 85)
})

test('released amount requires transferId when payoutStatus is paid', () => {
  const payment = {
    status: 'paid',
    payoutStatus: 'paid',
    artistPayout: 85,
    transferId: null,
  }
  assert.equal(artistReleasedAmount(payment), 0)
  assert.equal(artistEscrowAmount(payment), 85)

  const released = { ...payment, transferId: 'tr_123' }
  assert.equal(artistReleasedAmount(released), 85)
  assert.equal(artistEscrowAmount(released), 0)
})
