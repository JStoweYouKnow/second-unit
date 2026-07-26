import test from 'node:test'
import assert from 'node:assert/strict'
import { contractSigningHint, userNeedsToSign } from '../src/lib/contractSigning.js'

test('userNeedsToSign when pending and unsigned', () => {
  const c = { status: 'pending', signedByEmployer: false, signedByArtist: false }
  assert.equal(userNeedsToSign(c, false), true)
  assert.equal(userNeedsToSign(c, true), true)
})

test('userNeedsToSign false when party already signed', () => {
  const c = { status: 'pending', signedByEmployer: true, signedByArtist: false }
  assert.equal(userNeedsToSign(c, false), false)
  assert.equal(userNeedsToSign(c, true), true)
})

test('contractSigningHint mentions any order when neither signed', () => {
  const c = { status: 'pending', signedByEmployer: false, signedByArtist: false }
  assert.match(contractSigningHint(c, true), /any order/i)
})

test('contractSigningHint when other party signed first', () => {
  const c = { status: 'pending', signedByEmployer: true, signedByArtist: false }
  assert.match(contractSigningHint(c, true), /other party has signed/i)
})
