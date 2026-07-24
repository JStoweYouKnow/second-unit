import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildContractDocumentHash,
  buildTypedSignatureRecord,
} from '../api/_lib/contracts.js'

test('buildContractDocumentHash is stable for the same agreement snapshot', () => {
  const row = {
    id: 'c1',
    title: 'Spot',
    terms: 'Pay on approval',
    total_value: 1000,
    attachment_storage_path: 'c1/file.pdf',
    attachment_name: 'file.pdf',
    start_date: '2026-01-01',
    end_date: '2026-02-01',
  }
  const a = buildContractDocumentHash(row)
  const b = buildContractDocumentHash({ ...row })
  assert.equal(a.length, 64)
  assert.equal(a, b)
  assert.notEqual(a, buildContractDocumentHash({ ...row, terms: 'changed' }))
})

test('buildTypedSignatureRecord records audit fields for typed e-sign', () => {
  const sig = buildTypedSignatureRecord({
    name: 'Jamie Client',
    userId: 'user_1',
    ip: '1.2.3.4',
    userAgent: 'Mozilla/5.0',
    documentHash: 'abc',
  })
  assert.equal(sig.name, 'Jamie Client')
  assert.equal(sig.method, 'typed_esign')
  assert.equal(sig.ip, '1.2.3.4')
  assert.equal(sig.userAgent, 'Mozilla/5.0')
  assert.equal(sig.userId, 'user_1')
  assert.equal(sig.documentHash, 'abc')
  assert.ok(sig.date)
})
