import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getClientIp, rateLimit } from '../api/_lib/ratelimit.js'

const req = (headers, remoteAddress = '10.0.0.1') => ({ headers, socket: { remoteAddress } })

test('getClientIp prefers the proxy-set header over the forgeable one', () => {
  const ip = getClientIp(
    req({
      'x-vercel-forwarded-for': '203.0.113.7',
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8',
    })
  )
  assert.equal(ip, '203.0.113.7')
})

test('a spoofed x-forwarded-for cannot change the bucket on Vercel', () => {
  const trusted = '203.0.113.7'
  const a = getClientIp(req({ 'x-vercel-forwarded-for': trusted, 'x-forwarded-for': '1.1.1.1' }))
  const b = getClientIp(req({ 'x-vercel-forwarded-for': trusted, 'x-forwarded-for': '2.2.2.2' }))
  assert.equal(a, b, 'rotating x-forwarded-for must not yield a fresh rate limit bucket')
})

test('getClientIp falls back for local/Express runs', () => {
  assert.equal(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })), '1.2.3.4')
  assert.equal(getClientIp(req({})), '10.0.0.1')
  assert.equal(getClientIp({ headers: {}, socket: {} }), 'unknown')
})

test('getClientIp ignores empty header values', () => {
  assert.equal(getClientIp(req({ 'x-vercel-forwarded-for': '', 'x-real-ip': '5.6.7.8' })), '5.6.7.8')
})

test('rateLimit allows up to the limit then blocks within the window', () => {
  const key = `test-${Math.random()}`
  for (let i = 0; i < 5; i += 1) {
    assert.equal(rateLimit(key, 5, 60_000).ok, true, `request ${i + 1} should pass`)
  }
  assert.equal(rateLimit(key, 5, 60_000).ok, false, 'request past the limit should be blocked')
})

test('rateLimit keys are independent', () => {
  const a = `test-a-${Math.random()}`
  const b = `test-b-${Math.random()}`
  assert.equal(rateLimit(a, 1, 60_000).ok, true)
  assert.equal(rateLimit(a, 1, 60_000).ok, false)
  assert.equal(rateLimit(b, 1, 60_000).ok, true)
})
