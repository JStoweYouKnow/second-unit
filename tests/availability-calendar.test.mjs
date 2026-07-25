import assert from 'node:assert/strict'
import { buildForwardWeeks, buildMonthWeeks, todayKeyInZone } from '../src/lib/availability.js'

const TZ = 'America/Los_Angeles'
const todayKey = todayKeyInZone(TZ)
const [y, m, d] = todayKey.split('-').map(Number)
const monthDate = new Date(y, m - 1, 1)

const forward = buildForwardWeeks(2, { timeZone: TZ })
assert.equal(forward.weeks[0][0].dateKey, todayKey, 'forward calendar starts on today')
assert.equal(forward.weekdayLabels[0], forward.weeks[0][0].date.toLocaleDateString('en-US', { weekday: 'short' }))

const month = buildMonthWeeks(monthDate, { timeZone: TZ, hidePastDays: true })
assert.ok(month.weeks.length > 0, 'month grid has rows')
assert.equal(month.weeks[0][0].dateKey, todayKey, 'month grid starts on today with no leading blanks')
assert.ok(
  month.weeks.flat().every((cell) => cell.dateKey >= todayKey),
  'month grid excludes past days'
)

console.log('availability-calendar.test.mjs: ok')
