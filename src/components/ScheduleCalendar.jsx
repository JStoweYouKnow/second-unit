import { useMemo, useState } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from './icons'
import AvailabilityCalendarGrid from './AvailabilityCalendarGrid'
import { buildMonthWeeks, detectBrowserTimeZone } from '../lib/availability'
import { groupScheduleBookingsByDate } from '../lib/calendarDayMeta'

const LEGEND = [
  { key: 'pending', label: 'Pending', className: 'schedule-calendar__legend-dot--pending' },
  { key: 'confirmed', label: 'Confirmed', className: 'schedule-calendar__legend-dot--confirmed' },
  { key: 'scheduled', label: 'Paid / done', className: 'schedule-calendar__legend-dot--booked' },
]

export default function ScheduleCalendar({
  bookings = [],
  isArtist = false,
  selectedDateKey = null,
  onSelectDate,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const timeZone = useMemo(() => detectBrowserTimeZone(), [])

  const bookingsByDate = useMemo(
    () => groupScheduleBookingsByDate(bookings, { isArtist }),
    [bookings, isArtist]
  )

  const { weekdayLabels, weeks } = useMemo(
    () => buildMonthWeeks(currentMonth, { timeZone, hidePastDays: false }),
    [currentMonth, timeZone]
  )

  const handleDayClick = (cell) => {
    if (!cell.inMonth) return
    onSelectDate?.(selectedDateKey === cell.dateKey ? null : cell.dateKey)
  }

  return (
    <div className="card schedule-calendar">
      <div className="schedule-calendar__header">
        <div className="schedule-calendar__nav">
          <button
            type="button"
            className="btn-icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="schedule-calendar__month">{format(currentMonth, 'MMMM yyyy')}</span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setCurrentMonth(new Date())
            onSelectDate?.(null)
          }}
        >
          Today
        </button>
      </div>

      <AvailabilityCalendarGrid
        weeks={weeks}
        weekdayLabels={weekdayLabels}
        selectedDateKey={selectedDateKey}
        onDayClick={handleDayClick}
        bookingsByDate={bookingsByDate}
        scheduleMode
      />

      <div className="schedule-calendar__legend" aria-label="Booking status legend">
        {LEGEND.map((item) => (
          <span key={item.key} className="schedule-calendar__legend-item">
            <span className={`schedule-calendar__legend-dot ${item.className}`} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
