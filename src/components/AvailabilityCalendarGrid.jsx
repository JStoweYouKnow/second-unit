import { format } from 'date-fns'
import { getCalendarDayMeta } from '../lib/calendarDayMeta'

/**
 * Airbnb-style availability month grid — rounded tiles, captions, booking chips.
 */
export default function AvailabilityCalendarGrid({
  weeks,
  weekdayLabels,
  availability = [],
  selectedDateKey = null,
  onDayClick,
  editable = false,
  bookingMode = null,
  dayAnchor = null,
  dayEnd = null,
  dayRangeKeys = null,
  bookingsByDate = {},
  hideEmptyCells = false,
}) {
  const rangeSet = dayRangeKeys instanceof Set ? dayRangeKeys : new Set(dayRangeKeys || [])

  const isSelected = (cell) => {
    if (selectedDateKey === cell.dateKey) return true
    if (bookingMode === 'days' && (cell.dateKey === dayAnchor || cell.dateKey === dayEnd)) return true
    if (bookingMode === 'days' && rangeSet.has(cell.dateKey)) return true
    return false
  }

  const isClickable = (cell, meta) => {
    if (!cell.inMonth || cell.past || cell.hide) return false
    if (editable) return true
    return meta.hasOpen
  }

  return (
    <div className="airbnb-calendar">
      <div className="airbnb-calendar__weekdays">
        {weekdayLabels.map((d) => (
          <div key={d} className="airbnb-calendar__weekday">{d}</div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week[0]?.dateKey || week.map((c) => c.dateKey).join('-')} className="airbnb-calendar__week">
          {week.map((cell) => {
            if (hideEmptyCells && cell.hide) {
              return <div key={cell.dateKey} className="airbnb-calendar__day airbnb-calendar__day--spacer" aria-hidden />
            }

            const meta = getCalendarDayMeta(cell, availability, { editable })
            const selected = isSelected(cell)
            const clickable = isClickable(cell, meta)
            const chips = bookingsByDate[cell.dateKey] || []
            const chip = chips[0]

            const classNames = [
              'airbnb-calendar__day',
              !cell.inMonth && 'airbnb-calendar__day--other-month',
              cell.isToday && 'airbnb-calendar__day--today',
              cell.past && 'airbnb-calendar__day--past',
              meta.status === 'available' && 'airbnb-calendar__day--available',
              meta.status === 'booked-out' && 'airbnb-calendar__day--booked-out',
              meta.status === 'blocked' && 'airbnb-calendar__day--blocked',
              meta.status === 'empty' && editable && 'airbnb-calendar__day--empty',
              selected && 'airbnb-calendar__day--selected',
              !clickable && 'airbnb-calendar__day--disabled',
            ].filter(Boolean).join(' ')

            return (
              <button
                key={cell.dateKey}
                type="button"
                className={classNames}
                disabled={!clickable}
                onClick={() => clickable && onDayClick?.(cell)}
                aria-label={format(cell.date, 'EEEE, MMMM d, yyyy')}
                aria-pressed={selected}
              >
                {meta.showDogear && <span className="airbnb-calendar__dogear" aria-hidden />}
                {chip && (
                  <span className="airbnb-calendar__chip" title={chip.name}>
                    <span className="airbnb-calendar__chip-avatar">{chip.avatar}</span>
                    <span className="airbnb-calendar__chip-label">{chip.name}</span>
                  </span>
                )}
                {!chip && meta.hasBookings && editable && (
                  <span className="airbnb-calendar__side-tab" aria-hidden />
                )}
                <span className={`airbnb-calendar__date${meta.strikethrough ? ' airbnb-calendar__date--struck' : ''}`}>
                  {format(cell.date, 'd')}
                </span>
                {meta.caption && (
                  <span className="airbnb-calendar__caption">{meta.caption}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
