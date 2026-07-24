import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allowMockPayments,
  isVercelProduction,
  stripeKeyMode,
  isProductionRuntime,
} from '../api/_lib/env.js'

test('stripeKeyMode detects live, test, and unset keys', () => {
  assert.equal(stripeKeyMode('sk_live_abc'), 'live')
  assert.equal(stripeKeyMode('rk_live_abc'), 'live')
  assert.equal(stripeKeyMode('sk_test_abc'), 'test')
  assert.equal(stripeKeyMode('rk_test_abc'), 'test')
  assert.equal(stripeKeyMode(''), 'unset')
  assert.equal(stripeKeyMode(undefined), 'unset')
})

test('allowMockPayments never true when VERCEL_ENV=production', () => {
  const prevVercel = process.env.VERCEL_ENV
  const prevAllow = process.env.ALLOW_MOCK_PAYMENTS
  process.env.VERCEL_ENV = 'production'
  process.env.ALLOW_MOCK_PAYMENTS = 'true'
  try {
    assert.equal(isVercelProduction(), true)
    assert.equal(allowMockPayments(), false)
    assert.equal(isProductionRuntime(), true)
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = prevVercel
    if (prevAllow === undefined) delete process.env.ALLOW_MOCK_PAYMENTS
    else process.env.ALLOW_MOCK_PAYMENTS = prevAllow
  }
})

test('allowMockPayments true only with explicit opt-in off Vercel production', () => {
  const prevVercel = process.env.VERCEL_ENV
  const prevAllow = process.env.ALLOW_MOCK_PAYMENTS
  const prevNode = process.env.NODE_ENV
  delete process.env.VERCEL_ENV
  process.env.NODE_ENV = 'development'
  process.env.ALLOW_MOCK_PAYMENTS = 'true'
  try {
    assert.equal(allowMockPayments(), true)
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = prevVercel
    if (prevAllow === undefined) delete process.env.ALLOW_MOCK_PAYMENTS
    else process.env.ALLOW_MOCK_PAYMENTS = prevAllow
    if (prevNode === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNode
  }
})
