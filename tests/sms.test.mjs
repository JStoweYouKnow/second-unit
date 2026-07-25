import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePhone,
  formatSmsBody,
  smsDispatch,
} from '../api/_lib/sms.js'
import { prefAllowsSms } from '../api/_lib/notifications.js'

test('normalizePhone accepts US and E.164 formats', () => {
  assert.equal(normalizePhone('5551234567'), '+15551234567')
  assert.equal(normalizePhone('(555) 123-4567'), '+15551234567')
  assert.equal(normalizePhone('+44 7911 123456'), '+447911123456')
  assert.equal(normalizePhone('15551234567'), '+15551234567')
  assert.equal(normalizePhone(''), null)
  assert.equal(normalizePhone(null), null)
  assert.equal(normalizePhone('123'), null)
})

test('formatSmsBody includes title, body, and link', () => {
  const text = formatSmsBody({
    title: 'New message',
    body: 'Hello there',
    link: 'https://example.com/messages',
  })
  assert.match(text, /New message/)
  assert.match(text, /Hello there/)
  assert.match(text, /example\.com/)
})

test('smsDispatch returns null without phone', () => {
  assert.equal(
    smsDispatch({ email: 'a@b.com', notification_prefs: { sms: true } }, {
      title: 'Hi',
      body: 'Test',
      link: 'https://x.com',
      category: 'message',
    }),
    null
  )
})

test('smsDispatch builds payload when phone present', () => {
  const payload = smsDispatch(
    { phone: '+15551234567', notification_prefs: { sms: true } },
    { title: 'Booking confirmed', body: 'See app', link: 'https://x.com/p', category: 'booking' }
  )
  assert.equal(payload.to, '+15551234567')
  assert.match(payload.body, /Booking confirmed/)
  assert.equal(payload.category, 'booking')
})

test('prefAllowsSms requires master sms toggle', () => {
  assert.equal(prefAllowsSms({ sms: false, messages: true }, 'message'), false)
  assert.equal(prefAllowsSms({ sms: true, messages: true }, 'message'), true)
  assert.equal(prefAllowsSms({ sms: true, messages: false }, 'message'), false)
  assert.equal(prefAllowsSms({ sms: true, billing: false }, 'payment'), false)
  assert.equal(prefAllowsSms({ sms: true, marketing: false }, 'marketing'), false)
  assert.equal(prefAllowsSms({ sms: true, marketing: true }, 'marketing'), true)
})
