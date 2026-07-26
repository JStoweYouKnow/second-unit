import test from 'node:test'
import assert from 'node:assert/strict'
import { getCalendarDayMeta, groupBookingsByDate, bookingDateKeys, groupScheduleBookingsByDate, getScheduleDayMeta, bookingOccursOnDate } from '../src/lib/calendarDayMeta.js'

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

test('bookingDateKeys expands multi-day bookings', () => {
  const keys = bookingDateKeys({ date: '2026-08-10', durationUnit: 'days', duration: 3 })
  assert.deepEqual(keys, ['2026-08-10', '2026-08-11', '2026-08-12'])
})

test('groupScheduleBookingsByDate includes all active bookings', () => {
  const map = groupScheduleBookingsByDate([
    { id: '1', artistId: 'a1', artistName: 'Alex', date: '2026-08-03', type: 'Feature shoot', status: 'confirmed' },
    { id: '2', artistId: 'a2', artistName: 'Blake', date: '2026-08-03', type: 'Consult', status: 'pending' },
    { id: '3', artistId: 'a1', date: '2026-08-04', type: 'Cancelled', status: 'cancelled' },
  ])
  assert.equal(map['2026-08-03']?.length, 2)
  assert.equal(map['2026-08-04'], undefined)
})

test('getScheduleDayMeta prioritizes pending status', () => {
  const cell = { dateKey: '2026-08-03', inMonth: true, past: false, hide: false }
  const meta = getScheduleDayMeta(cell, [
    { status: 'confirmed' },
    { status: 'pending' },
  ])
  assert.equal(meta.status, 'pending')
  assert.match(meta.caption, /2 bookings/)
})

test('bookingOccursOnDate matches span days', () => {
  const booking = { date: '2026-08-10', durationUnit: 'days', duration: 2 }
  assert.equal(bookingOccursOnDate(booking, '2026-08-10'), true)
  assert.equal(bookingOccursOnDate(booking, '2026-08-11'), true)
  assert.equal(bookingOccursOnDate(booking, '2026-08-12'), false)
})
