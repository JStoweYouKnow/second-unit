import test from 'node:test'
import assert from 'node:assert/strict'
import { getCalendarDayMeta, groupBookingsByDate } from '../src/lib/calendarDayMeta.js'

test('getCalendarDayMeta marks available days with open hour count', () => {
  const cell = { dateKey: '2026-08-01', inMonth: true, past: false, hide: false }
  const availability = [{ date: '2026-08-01', slots: ['9:00 AM', '10:00 AM'], bookedSlots: [] }]
  const meta = getCalendarDayMeta(cell, availability, { editable: true })
  assert.equal(meta.status, 'available')
  assert.equal(meta.openCount, 2)
  assert.match(meta.caption, /2 hrs open/)
})

test('getCalendarDayMeta strikethrough booked-out days', () => {
  const cell = { dateKey: '2026-08-02', inMonth: true, past: false, hide: false }
  const availability = [{ date: '2026-08-02', slots: ['9:00 AM'], bookedSlots: ['9:00 AM'] }]
  const meta = getCalendarDayMeta(cell, availability, { editable: true })
  assert.equal(meta.status, 'booked-out')
  assert.equal(meta.strikethrough, true)
})

test('groupBookingsByDate maps artist bookings by date', () => {
  const map = groupBookingsByDate([
    { id: '1', artistId: 'a1', date: '2026-08-03', type: 'Feature shoot', status: 'confirmed' },
    { id: '2', artistId: 'a2', date: '2026-08-03', type: 'Other', status: 'confirmed' },
    { id: '3', artistId: 'a1', date: '2026-08-04', type: 'Consult', status: 'cancelled' },
  ], 'a1')
  assert.equal(map['2026-08-03']?.length, 1)
  assert.equal(map['2026-08-03'][0].name, 'Feature shoot')
  assert.equal(map['2026-08-04'], undefined)
})
