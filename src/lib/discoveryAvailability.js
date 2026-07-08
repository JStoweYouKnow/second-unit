import { groupSlotsByDate } from './availability'
import { applyGoogleBusyToAvailability } from './googleBusy'

/**
 * Dates that still have at least one bookable slot (not booked, not Google-busy).
 * @param {Array<{ date: string, slots?: string[], bookedSlots?: string[] }>} grouped
 * @param {Array<{ date: string, start_time: string, end_time: string }>} busyRows
 */
export function datesWithOpenSlots(grouped, busyRows) {
  const adjusted = applyGoogleBusyToAvailability(grouped, busyRows)
  const dates = []

  for (const entry of adjusted) {
    const booked = new Set(entry.bookedSlots || [])
    const hasOpen = (entry.slots || []).some((label) => !booked.has(label))
    if (hasOpen) dates.push(entry.date)
  }

  return [...new Set(dates)]
}

/**
 * @param {Array<{ date: string, start_time: string, end_time: string, is_booked?: boolean }>} availabilityRows
 * @param {Array<{ date: string, start_time: string, end_time: string }>} busyRows
 */
export function availabilityDatesFromRows(availabilityRows, busyRows) {
  return datesWithOpenSlots(groupSlotsByDate(availabilityRows || []), busyRows || [])
}
