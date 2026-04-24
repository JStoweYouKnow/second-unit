import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns'
import { X, ChevronLeft, ChevronRight, ExternalLink, Download, Clock, MapPin } from './icons'

// Generate demo availability for current and next month
function generateAvailability() {
  const slots = []
  const now = new Date()
  for (let m = 0; m < 2; m++) {
    const month = addMonths(now, m)
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    let day = start
    while (day <= end) {
      const dow = day.getDay()
      // Available on weekdays with some randomness
      if (dow >= 1 && dow <= 5 && Math.random() > 0.3) {
        const times = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM']
        const available = times.filter(() => Math.random() > 0.4)
        if (available.length > 0) {
          slots.push({ date: format(day, 'yyyy-MM-dd'), slots: available })
        }
      }
      day = addDays(day, 1)
    }
  }
  return slots
}

const CAL_COMP_NOTE = 'Compensation is agreed with the client for each engagement (not shown here).'

export default function CalendarModal({ artist, onClose, onBook }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Use provided availability or generate demo data
  const availability = artist.availability?.length > 0 ? artist.availability : generateAvailability()
  const availableDates = availability.map(a => a.date)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const rows = []
  let days = []
  let day = startDate

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const d = day
      const dateStr = format(d, 'yyyy-MM-dd')
      const hasSlots = availableDates.includes(dateStr)
      const isPast = d < new Date(new Date().setHours(0,0,0,0))
      const isSelected = selectedDate && isSameDay(d, selectedDate)
      days.push(
        <div key={d.toString()}
          className={`calendar-day ${!isSameMonth(d, monthStart) ? 'other-month' : ''} ${isToday(d) ? 'today' : ''} ${hasSlots && !isPast ? 'has-event' : ''}`}
          style={{
            ...(isSelected ? { background: 'var(--accent)', color: 'white', borderRadius: 'var(--radius-sm)' } : {}),
            ...(hasSlots && !isPast ? { cursor: 'pointer' } : { cursor: 'default' }),
            ...(isPast ? { opacity: 0.3 } : {}),
          }}
          onClick={() => hasSlots && !isPast && (setSelectedDate(d), setSelectedSlot(null))}>
          {format(d, 'd')}
        </div>
      )
      day = addDays(day, 1)
    }
    rows.push(<div key={day.toString()} className="calendar-grid">{days}</div>)
    days = []
  }

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const availableSlots = availability.find(a => a.date === selectedDateStr)?.slots || []

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Google Calendar link generator
  const generateGoogleCalendarLink = (date, time) => {
    const dateObj = new Date(`${date}T${convertTo24h(time)}:00`)
    const endObj = new Date(dateObj.getTime() + 60 * 60 * 1000) // 1 hour
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    return `https://calendar.google.com/calendar/event?action=TEMPLATE&text=${encodeURIComponent(`Session with ${artist.name}`)}&dates=${fmt(dateObj)}/${fmt(endObj)}&details=${encodeURIComponent(`Booked through Second Unit\nArtist: ${artist.name}\n${CAL_COMP_NOTE}`)}`
  }

  // .ics file download
  const downloadICS = (date, time) => {
    const dateObj = new Date(`${date}T${convertTo24h(time)}:00`)
    const endObj = new Date(dateObj.getTime() + 60 * 60 * 1000)
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${fmt(dateObj)}
DTEND:${fmt(endObj)}
SUMMARY:Session with ${artist.name}
DESCRIPTION:Booked through Second Unit\\n${CAL_COMP_NOTE.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session_${artist.name.replace(/\s/g, '_')}_${date}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  function convertTo24h(time12h) {
    const [time, mod] = time12h.split(' ')
    let [h, m] = time.split(':')
    if (h === '12') h = '00'
    if (mod === 'PM') h = parseInt(h) + 12
    return `${String(h).padStart(2, '0')}:${m}`
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="calendar-modal-title">{`${artist.name}'s availability`}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close calendar">
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Artist Quick Info */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
          <div className="avatar">{artist.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{artist.name}</div>
            <div style={{ fontSize: 13, color: 'var(--accent)' }}>{artist.role}</div>
          </div>
          <div style={{ textAlign: 'right', maxWidth: 220 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{CAL_COMP_NOTE}</div>
            <div style={{ fontSize: 12, color: artist.available ? 'var(--success)' : 'var(--text-muted)', marginTop: 6 }}>
              {artist.available ? '● Available' : '○ Unavailable'}
            </div>
          </div>
        </div>

        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn-icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: 16 }}>{format(currentMonth, 'MMMM yyyy')}</span>
          <button className="btn-icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={16} /></button>
        </div>

        {/* Calendar Header */}
        <div className="calendar-grid" style={{ marginBottom: 4 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="calendar-header">{d}</div>
          ))}
        </div>
        {rows}

        {/* Selected Date Slots */}
        {selectedDate && (
          <div className="slide-up" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} style={{ color: 'var(--accent)' }} />
              Available slots for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            {availableSlots.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    className={`btn ${selectedSlot === slot ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No slots available for this date.</p>
            )}
          </div>
        )}

        {/* Selected Slot Actions */}
        {selectedSlot && selectedDateStr && (
          <div className="slide-up" style={{ marginTop: 20, padding: 20, background: 'rgba(124,92,252,0.05)', border: '1px solid rgba(124,92,252,0.15)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {format(selectedDate, 'MMM d')} at {selectedSlot}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  1 hour hold · confirm scope and fees with the client before work begins.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => onBook && onBook(artist, selectedDateStr, selectedSlot)}>
                Book This Slot
              </button>
              <a
                href={generateGoogleCalendarLink(selectedDateStr, selectedSlot)}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> Add to Google Calendar
              </a>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadICS(selectedDateStr, selectedSlot)}>
                <Download size={14} /> Download .ics
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} /> Available
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 16, borderRadius: 'var(--radius-sm)', background: 'var(--accent)', fontSize: 10, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>15</span> Selected
          </span>
          <span>Click a date → pick a time → book or sync to your calendar</span>
        </div>
      </div>
    </div>
  )
}
