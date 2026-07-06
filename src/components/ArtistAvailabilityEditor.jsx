import { useState, useEffect, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, Loader2, CheckCircle } from './icons'
import { useArtistAvailability } from '../hooks/useArtistAvailability'
import {
  STANDARD_SLOT_LABELS,
  isPastDate,
  sortSlotLabels,
} from '../lib/availability'

export default function ArtistAvailabilityEditor({ artistId, artistName }) {
  const { availability, loading, saving, error, updateDayAvailability } = useArtistAvailability(artistId)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [draftSlots, setDraftSlots] = useState([])
  const [saveStatus, setSaveStatus] = useState('')

  const availableDates = useMemo(() => availability.map((a) => a.date), [availability])

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const dayEntry = availability.find((a) => a.date === selectedDateStr)
  const bookedOnDay = dayEntry?.bookedSlots || []

  useEffect(() => {
    if (!selectedDateStr) {
      setDraftSlots([])
      return
    }
    setDraftSlots(dayEntry?.slots ? [...dayEntry.slots] : [])
    setSaveStatus('')
  }, [selectedDateStr, dayEntry])

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
      const past = isPastDate(d)
      const isSelected = selectedDate && isSameDay(d, selectedDate)

      days.push(
        <button
          key={d.toString()}
          type="button"
          disabled={past}
          className={`calendar-day ${!isSameMonth(d, monthStart) ? 'other-month' : ''} ${isToday(d) ? 'today' : ''} ${hasSlots ? 'has-event' : ''} ${isSelected ? 'calendar-day--selected' : ''}`}
          onClick={() => {
            if (past) return
            setSelectedDate(d)
            setSaveStatus('')
          }}
          style={{
            opacity: past ? 0.35 : 1,
            cursor: past ? 'default' : 'pointer',
            border: 'none',
            background: isSelected ? 'var(--accent)' : 'transparent',
            color: isSelected ? 'white' : undefined,
          }}
          aria-label={format(d, 'EEEE, MMMM d, yyyy')}
          aria-pressed={isSelected}
        >
          {format(d, 'd')}
        </button>
      )
      day = addDays(day, 1)
    }
    rows.push(
      <div key={day.toString()} className="calendar-grid">
        {days}
      </div>
    )
    days = []
  }

  const toggleSlot = (label) => {
    if (bookedOnDay.includes(label)) return
    setDraftSlots((prev) => {
      const set = new Set(prev)
      if (set.has(label)) set.delete(label)
      else set.add(label)
      return sortSlotLabels([...set])
    })
    setSaveStatus('')
  }

  const applyPreset = (labels) => {
    const merged = sortSlotLabels([...new Set([...bookedOnDay, ...labels])])
    setDraftSlots(merged)
    setSaveStatus('')
  }

  const handleSave = async () => {
    if (!selectedDateStr) return
    setSaveStatus('')
    const { error: saveError } = await updateDayAvailability(selectedDateStr, draftSlots)
    if (saveError) {
      setSaveStatus(saveError.message)
    } else {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2500)
    }
  }

  const draftChanged =
    selectedDateStr &&
    sortSlotLabels(draftSlots).join('|') !== sortSlotLabels(dayEntry?.slots || []).join('|')

  return (
    <div className="card slide-up" style={{ padding: 24, marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 6px 0' }}>
            Availability calendar
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, maxWidth: 520 }}>
            Set the hours you&apos;re open for bookings. Clients see this on your profile and spotlight listing.
          </p>
        </div>
        {loading && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={14} className="animate-spin" /> Loading…
          </span>
        )}
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button type="button" className="btn-icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: 16 }}>
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button type="button" className="btn-icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="calendar-grid" style={{ marginBottom: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="calendar-header">{d}</div>
        ))}
      </div>
      {rows}

      {selectedDate && (
        <div className="slide-up" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => applyPreset(STANDARD_SLOT_LABELS)}
            >
              Full day (9 AM – 5 PM)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => applyPreset(STANDARD_SLOT_LABELS.filter((_, i) => i < 4))}
            >
              Morning only
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDraftSlots([...bookedOnDay])}
            >
              Clear unbooked slots
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {STANDARD_SLOT_LABELS.map((slot) => {
              const active = draftSlots.includes(slot)
              const locked = bookedOnDay.includes(slot)
              return (
                <button
                  key={slot}
                  type="button"
                  className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleSlot(slot)}
                  disabled={locked}
                  title={locked ? 'Booked — cannot remove' : undefined}
                >
                  {slot}
                  {locked && ' · booked'}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !draftChanged}
              aria-busy={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving…
                </>
              ) : (
                'Save this day'
              )}
            </button>
            {saveStatus === 'saved' && (
              <span style={{ fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={14} /> Availability updated
              </span>
            )}
            {saveStatus && saveStatus !== 'saved' && (
              <span style={{ fontSize: 13, color: 'var(--danger)' }}>{saveStatus}</span>
            )}
          </div>
        </div>
      )}

      {!selectedDate && (
        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Select a date to set your hours for {artistName || 'your profile'}.
        </p>
      )}

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          Dot = day has availability · Booked slots stay locked
        </span>
      </div>
    </div>
  )
}
