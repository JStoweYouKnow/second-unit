import { labelToStartTime, labelToEndTime, sortSlotLabels } from './availability'

function timeToMinutes(timeStr) {
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function slotOverlapsBusy(label, busyStart, busyEnd) {
  const slotStart = timeToMinutes(labelToStartTime(label))
  const slotEnd = timeToMinutes(labelToEndTime(label))
  const bStart = timeToMinutes(busyStart)
  const bEnd = timeToMinutes(busyEnd)
  return slotStart < bEnd && slotEnd > bStart
}

/** Mark standard slots blocked by imported Google Calendar busy times. */
export function applyGoogleBusyToAvailability(grouped, busyRows) {
  if (!busyRows?.length) return grouped

  const byDate = new Map()
  for (const block of busyRows) {
    const date = String(block.date).slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(block)
  }

  return grouped.map((entry) => {
    const blocks = byDate.get(entry.date) || []
    if (!blocks.length) return entry

    const booked = new Set(entry.bookedSlots || [])
    for (const label of entry.slots || []) {
      for (const block of blocks) {
        if (slotOverlapsBusy(label, block.start_time, block.end_time)) {
          booked.add(label)
        }
      }
    }

    return {
      ...entry,
      bookedSlots: sortSlotLabels(Array.from(booked)),
      googleBusy: true,
    }
  })
}
