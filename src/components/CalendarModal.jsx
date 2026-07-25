import { useState, useEffect, useMemo } from 'react'
import { format, addMonths, subMonths, parse, addHours } from 'date-fns'
import { X, ChevronLeft, ChevronRight, ExternalLink, Download, Clock, Loader2, CheckCircle } from './icons'
import { useArtistAvailability } from '../hooks/useArtistAvailability'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  normalizeArtistAvailability,
  buildMonthWeeks,
  isMonthFullyPast,
  detectBrowserTimeZone,
  formatTimeZoneLabel,
  getOpenSlotsForDate,
  datesWithOpenSlots,
  resolveContiguousHourRange,
  resolveDayRange,
  buildBookingPrefillFromSelection,
  labelToFormTime,
  STANDARD_SLOT_LABELS,
  SLOT_PRESETS,
  sortSlotLabels,
  listTimeZones,
  isPastDate,
} from '../lib/availability'

const CAL_COMP_NOTE = 'Compensation is agreed with the client for each engagement (not shown here).'

function convertTo24h(time12h) {
  const [time, mod] = time12h.split(' ')
  let [h, m] = time.split(':')
  if (h === '12') h = '00'
  if (mod === 'PM') h = parseInt(h, 10) + 12
  return `${String(h).padStart(2, '0')}:${m}`
}

function rangeEndDateTime(dateKey, startLabel, durationHours) {
  const start = new Date(`${dateKey}T${convertTo24h(startLabel)}:00`)
  return addHours(start, durationHours)
}

export default function CalendarModal({
  artist,
  onClose,
  onBook,
  editable = false,
  artistDbId = null,
  onAvailabilitySaved = null,
}) {
  const resolvedArtistId = artistDbId || artist.id
  const {
    availability: liveAvailability,
    loading: availabilityLoading,
    saving: availabilitySaving,
    error: availabilityError,
    updateDayAvailability,
  } = useArtistAvailability(editable ? resolvedArtistId : null)

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [mode, setMode] = useState('hours') // 'hours' | 'days'
  const [selectedDate, setSelectedDate] = useState(null)
  const [hourAnchor, setHourAnchor] = useState(null)
  const [hourEnd, setHourEnd] = useState(null)
  const [dayAnchor, setDayAnchor] = useState(null)
  const [dayEnd, setDayEnd] = useState(null)
  const [rangeError, setRangeError] = useState('')
  const [draftSlots, setDraftSlots] = useState([])
  const [saveStatus, setSaveStatus] = useState('')
  const [timeZone, setTimeZone] = useState(artist.timezone || detectBrowserTimeZone())
  const [tzSaving, setTzSaving] = useState(false)
  const [tzStatus, setTzStatus] = useState('')

  const timeZones = useMemo(() => listTimeZones(), [])

  useEffect(() => {
    if (artist.timezone) setTimeZone(artist.timezone)
  }, [artist.timezone])

  const availability = useMemo(() => {
    if (editable) return liveAvailability
    return normalizeArtistAvailability(artist.availability)
  }, [editable, liveAvailability, artist.availability])

  const availableDateKeys = useMemo(
    () => (availability || []).map((entry) => entry.date),
    [availability]
  )
  const availableDateSet = useMemo(() => new Set(availableDateKeys), [availableDateKeys])

  const openDateKeys = useMemo(() => datesWithOpenSlots(availability), [availability])
  const openDateSet = useMemo(() => new Set(openDateKeys), [openDateKeys])

  const { weekdayLabels, weeks } = useMemo(
    () => buildMonthWeeks(currentMonth, { timeZone, hidePastDays: true }),
    [currentMonth, timeZone]
  )

  const canGoPrev = !isMonthFullyPast(subMonths(currentMonth, 1), timeZone)

  const selectedDateStr = selectedDate || null
  const dayEntry = useMemo(
    () => (selectedDateStr ? availability.find((a) => a.date === selectedDateStr) : null),
    [availability, selectedDateStr]
  )
  const bookedOnDay = dayEntry?.bookedSlots || []

  useEffect(() => {
    if (!editable || !selectedDateStr) {
      setDraftSlots([])
      return
    }
    setDraftSlots(dayEntry?.slots ? [...dayEntry.slots] : [])
    setSaveStatus('')
  }, [editable, selectedDateStr, dayEntry])

  const openSlots = useMemo(
    () => (selectedDateStr ? getOpenSlotsForDate(availability, selectedDateStr) : []),
    [availability, selectedDateStr]
  )

  const hourRange = useMemo(() => {
    if (mode !== 'hours' || !hourAnchor || !hourEnd) return null
    return resolveContiguousHourRange(openSlots, hourAnchor, hourEnd)
  }, [mode, openSlots, hourAnchor, hourEnd])

  const dayRange = useMemo(() => {
    if (mode !== 'days' || !dayAnchor || !dayEnd) return null
    return resolveDayRange(availability, dayAnchor, dayEnd)
  }, [mode, availability, dayAnchor, dayEnd])

  const bookingPrefill = useMemo(() => {
    if (mode === 'hours' && hourRange && selectedDateStr) {
      return buildBookingPrefillFromSelection({
        durationUnit: 'hours',
        date: selectedDateStr,
        hourRange,
      })
    }
    if (mode === 'days' && dayRange) {
      return buildBookingPrefillFromSelection({
        durationUnit: 'days',
        dayRange,
      })
    }
    return null
  }, [mode, hourRange, selectedDateStr, dayRange])

  const dayRangeKeys = useMemo(() => new Set(dayRange?.dateKeys || []), [dayRange])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const resetSelection = () => {
    setSelectedDate(null)
    setHourAnchor(null)
    setHourEnd(null)
    setDayAnchor(null)
    setDayEnd(null)
    setRangeError('')
  }

  const switchMode = (next) => {
    setMode(next)
    resetSelection()
  }

  const handleDayClick = (cell) => {
    if (cell.hide || cell.past || !cell.inMonth) return
    const key = cell.dateKey

    if (editable) {
      setSelectedDate(key)
      setRangeError('')
      return
    }

    setRangeError('')
    if (!openDateSet.has(key)) return

    if (mode === 'hours') {
      setSelectedDate(key)
      setHourAnchor(null)
      setHourEnd(null)
      return
    }

    // Days mode: first click sets anchor, second completes range
    if (!dayAnchor || (dayAnchor && dayEnd)) {
      setDayAnchor(key)
      setDayEnd(null)
      setSelectedDate(key)
      return
    }

    const resolved = resolveDayRange(availability, dayAnchor, key)
    if (!resolved) {
      setRangeError('Every day in the range needs open availability. Pick a continuous block of open days.')
      setDayEnd(null)
      return
    }
    setDayAnchor(resolved.startDate)
    setDayEnd(resolved.endDate)
    setSelectedDate(resolved.startDate)
  }

  const handleHourClick = (label) => {
    setRangeError('')
    if (!hourAnchor || (hourAnchor && hourEnd)) {
      setHourAnchor(label)
      setHourEnd(null)
      return
    }

    const resolved = resolveContiguousHourRange(openSlots, hourAnchor, label)
    if (!resolved) {
      setRangeError('Select a continuous block of open hours (no gaps or booked slots).')
      return
    }
    setHourAnchor(resolved.startLabel)
    setHourEnd(resolved.endLabel)
  }

  const isHourInSelection = (label) => {
    if (!hourAnchor) return false
    if (!hourEnd) return label === hourAnchor
    const range = resolveContiguousHourRange(openSlots, hourAnchor, hourEnd)
    return range?.slots.includes(label)
  }

  const selectionSummary = () => {
    if (mode === 'hours' && hourRange && selectedDateStr) {
      const endDisplay = hourRange.endLabel
      const endParsed = parse(endDisplay, 'h:mm a', new Date())
      const rangeEndsAt = format(addHours(endParsed, 1), 'h:mm a')
      return `${format(new Date(`${selectedDateStr}T12:00:00`), 'MMM d')} · ${hourRange.startLabel} – ${rangeEndsAt} (${hourRange.durationHours} hour${hourRange.durationHours === 1 ? '' : 's'})`
    }
    if (mode === 'days' && dayRange) {
      const start = format(new Date(`${dayRange.startDate}T12:00:00`), 'MMM d')
      const end = format(new Date(`${dayRange.endDate}T12:00:00`), 'MMM d')
      return dayRange.durationDays === 1
        ? `${start} (1 day)`
        : `${start} – ${end} (${dayRange.durationDays} days)`
    }
    return null
  }

  const generateGoogleCalendarLink = () => {
    if (!bookingPrefill) return '#'
    const startLabel =
      mode === 'hours'
        ? hourRange.startLabel
        : (dayRange?.startLabel || '9:00 AM')
    const durationHours =
      mode === 'hours'
        ? hourRange.durationHours
        : dayRange.durationDays * 24
    const dateObj = new Date(`${bookingPrefill.date}T${convertTo24h(startLabel)}:00`)
    const endObj = rangeEndDateTime(bookingPrefill.date, startLabel, durationHours)
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    return `https://calendar.google.com/calendar/event?action=TEMPLATE&text=${encodeURIComponent(`Session with ${artist.name}`)}&dates=${fmt(dateObj)}/${fmt(endObj)}&details=${encodeURIComponent(`Booked through The Callsheet\nArtist: ${artist.name}\nTimezone: ${timeZone}\n${CAL_COMP_NOTE}`)}`
  }

  const downloadICS = () => {
    if (!bookingPrefill) return
    const startLabel =
      mode === 'hours'
        ? hourRange.startLabel
        : (dayRange?.startLabel || '9:00 AM')
    const durationHours =
      mode === 'hours'
        ? hourRange.durationHours
        : dayRange.durationDays * 24
    const dateObj = new Date(`${bookingPrefill.date}T${convertTo24h(startLabel)}:00`)
    const endObj = rangeEndDateTime(bookingPrefill.date, startLabel, durationHours)
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${fmt(dateObj)}
DTEND:${fmt(endObj)}
SUMMARY:Session with ${artist.name}
DESCRIPTION:Booked through The Callsheet\\nTimezone: ${timeZone}\\n${CAL_COMP_NOTE.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session_${artist.name.replace(/\s/g, '_')}_${bookingPrefill.date}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleContinue = () => {
    if (!bookingPrefill || !onBook) return
    onBook({
      artist,
      date: bookingPrefill.date,
      time: bookingPrefill.time || labelToFormTime(hourRange?.startLabel),
      duration: bookingPrefill.duration,
      durationUnit: bookingPrefill.durationUnit,
    })
  }

  const persistTimeZone = async (nextTz) => {
    setTimeZone(nextTz)
    setTzStatus('')
    if (!resolvedArtistId || !isSupabaseConfigured || !supabase) return
    setTzSaving(true)
    try {
      const { error: tzErr } = await supabase
        .from('artists')
        .update({ timezone: nextTz, updated_at: new Date().toISOString() })
        .eq('id', resolvedArtistId)
      if (tzErr) throw tzErr
      setTzStatus('saved')
      onAvailabilitySaved?.()
      setTimeout(() => setTzStatus(''), 2000)
    } catch (err) {
      setTzStatus(err.message || 'Could not save timezone')
    } finally {
      setTzSaving(false)
    }
  }

  const toggleEditSlot = (label) => {
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

  const handleSaveDay = async () => {
    if (!selectedDateStr) return
    setSaveStatus('')
    const { error: saveError } = await updateDayAvailability(selectedDateStr, draftSlots)
    if (saveError) {
      setSaveStatus(saveError.message)
      return
    }
    setSaveStatus('saved')
    onAvailabilitySaved?.()
    setTimeout(() => setSaveStatus(''), 2500)
  }

  const draftChanged =
    editable &&
    selectedDateStr &&
    sortSlotLabels(draftSlots).join('|') !== sortSlotLabels(dayEntry?.slots || []).join('|')

  const selectedDateObj = selectedDateStr ? new Date(`${selectedDateStr}T12:00:00`) : null
  const showEditPanel =
    editable && selectedDateStr && selectedDateObj && !isPastDate(selectedDateObj, timeZone)

  const summary = selectionSummary()

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="calendar-modal-title">
            {editable ? 'Manage your availability' : `${artist.name}'s availability`}
          </h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close calendar">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
          <div className="avatar">{artist.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{artist.name}</div>
            <div style={{ fontSize: 13, color: 'var(--accent)' }}>{artist.role}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Times in {formatTimeZoneLabel(timeZone)}
            </div>
          </div>
          <div style={{ textAlign: 'right', maxWidth: 220 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{CAL_COMP_NOTE}</div>
            <div style={{ fontSize: 12, color: artist.available ? 'var(--success)' : 'var(--text-muted)', marginTop: 6 }}>
              {artist.available ? '● Available' : '○ Unavailable'}
            </div>
          </div>
        </div>

        {editable && (
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" htmlFor="calendar-modal-timezone">Working timezone</label>
            <select
              id="calendar-modal-timezone"
              className="form-input"
              value={timeZone}
              onChange={(e) => persistTimeZone(e.target.value)}
              disabled={tzSaving}
              style={{ maxWidth: 360 }}
            >
              {!timeZones.includes(timeZone) && timeZone && (
                <option value={timeZone}>{formatTimeZoneLabel(timeZone)}</option>
              )}
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>{formatTimeZoneLabel(tz)}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
              Hours you set are wall-clock times in {formatTimeZoneLabel(timeZone)}.
              {tzSaving && ' Saving…'}
              {tzStatus === 'saved' && ' Saved.'}
              {tzStatus && tzStatus !== 'saved' && (
                <span style={{ color: 'var(--danger)' }}> {tzStatus}</span>
              )}
            </span>
          </div>
        )}

        {availabilityError && (
          <div className="auth-error" style={{ marginBottom: 16 }}>{availabilityError}</div>
        )}

        {!editable && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'hours' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchMode('hours')}
          >
            Hours
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'days' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchMode('days')}
          >
            Days
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {mode === 'hours'
              ? 'Pick a day, then a start and end hour'
              : 'Pick a start day, then an end day'}
          </span>
        </div>
        )}

        {editable && (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            Select a date, then tap hours to open them for booking. Booked slots stay locked.
            {availabilityLoading && ' Loading availability…'}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            type="button"
            className="btn-icon"
            onClick={() => canGoPrev && setCurrentMonth(subMonths(currentMonth, 1))}
            disabled={!canGoPrev}
            style={{ opacity: canGoPrev ? 1 : 0.35 }}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: 16 }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="calendar-grid" style={{ marginBottom: 4 }}>
          {weekdayLabels.map((d) => (
            <div key={d} className="calendar-header">{d}</div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0].dateKey} className="calendar-grid">
            {week.map((cell) => {
              const hasOpen = openDateSet.has(cell.dateKey)
              const hasAnySlots = availableDateSet.has(cell.dateKey)
              const isSelectedHours = !editable && mode === 'hours' && selectedDateStr === cell.dateKey
              const isSelectedEdit = editable && selectedDateStr === cell.dateKey
              const inDayRange = !editable && mode === 'days' && (
                dayRangeKeys.has(cell.dateKey)
                || cell.dateKey === dayAnchor
                || cell.dateKey === dayEnd
              )
              const isSelected = isSelectedHours || isSelectedEdit || inDayRange
              const clickable = editable
                ? cell.inMonth && !cell.past
                : hasOpen && cell.inMonth && !cell.past

              return (
                <div
                  key={cell.dateKey}
                  className={`calendar-day ${!cell.inMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''} ${(editable ? hasAnySlots : hasOpen) ? 'has-event' : ''}`}
                  style={{
                    ...(isSelected
                      ? { background: 'var(--accent)', color: 'var(--paper)', borderRadius: 'var(--radius-sm)' }
                      : {}),
                    cursor: clickable ? 'pointer' : 'default',
                    opacity: cell.past || !cell.inMonth ? 0.3 : (editable ? hasAnySlots : hasOpen) ? 1 : 0.45,
                  }}
                  onClick={() => handleDayClick(cell)}
                >
                  {format(cell.date, 'd')}
                </div>
              )
            })}
          </div>
        ))}

        {availability.length === 0 && !editable && (
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text-muted)' }}>
            No availability published yet. This artist hasn&apos;t opened booking slots on their calendar.
          </p>
        )}

        {editable && !selectedDateStr && (
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text-muted)' }}>
            Pick a date on the calendar to set your open hours.
          </p>
        )}

        {showEditPanel && (
          <div className="slide-up" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} style={{ color: 'var(--accent)' }} />
              {format(new Date(`${selectedDateStr}T12:00:00`), 'EEEE, MMMM d, yyyy')}
              <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 13 }}>
                · {formatTimeZoneLabel(timeZone)}
              </span>
            </h3>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(SLOT_PRESETS.fullDay)}>
                Full day
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(SLOT_PRESETS.business)}>
                Business hours
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(SLOT_PRESETS.morning)}>
                Morning
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(SLOT_PRESETS.afternoon)}>
                Afternoon
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(SLOT_PRESETS.evening)}>
                Evening
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDraftSlots([...bookedOnDay])}
              >
                Clear unbooked
              </button>
            </div>

            <div
              className="availability-slot-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: 8,
                marginBottom: 20,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {STANDARD_SLOT_LABELS.map((slot) => {
                const active = draftSlots.includes(slot)
                const locked = bookedOnDay.includes(slot)
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleEditSlot(slot)}
                    disabled={locked}
                    title={locked ? 'Booked — cannot remove' : active ? 'Open — click to block' : 'Blocked — click to open'}
                    style={{ justifyContent: 'center' }}
                  >
                    {slot}
                    {locked ? ' · booked' : ''}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveDay}
                disabled={availabilitySaving || !draftChanged}
                aria-busy={availabilitySaving}
              >
                {availabilitySaving ? (
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

        {!editable && mode === 'hours' && selectedDateStr && (
          <div className="slide-up" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} style={{ color: 'var(--accent)' }} />
              Hours for {format(new Date(`${selectedDateStr}T12:00:00`), 'EEEE, MMMM d, yyyy')}
              <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 13 }}>
                · {formatTimeZoneLabel(timeZone)}
              </span>
            </h3>
            {openSlots.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: 8,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {openSlots.map((slot) => {
                  const active = isHourInSelection(slot)
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`btn ${active ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => handleHourClick(slot)}
                      style={{ justifyContent: 'center' }}
                    >
                      {slot}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No open slots for this date.</p>
            )}
            {!hourEnd && hourAnchor && (
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                Now pick an end hour (click the same hour again for a 1-hour booking).
              </p>
            )}
          </div>
        )}

        {!editable && mode === 'days' && dayAnchor && !dayEnd && (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Start day selected. Click another open day to complete the range
            {dayAnchor ? ` (from ${format(new Date(`${dayAnchor}T12:00:00`), 'MMM d')})` : ''}.
          </p>
        )}

        {rangeError && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--danger)' }}>{rangeError}</p>
        )}

        {!editable && bookingPrefill && summary && (
          <div className="slide-up" style={{ marginTop: 20, padding: 20, background: 'var(--accent-tint-05)', border: '1px solid var(--accent-tint-border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{summary}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {formatTimeZoneLabel(timeZone)} · confirm scope and fees with the artist on the next step.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {onBook && (
                <button type="button" className="btn btn-primary" onClick={handleContinue}>
                  Continue to book
                </button>
              )}
              <a
                href={generateGoogleCalendarLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> Add to Google Calendar
              </a>
              <button type="button" className="btn btn-secondary btn-sm" onClick={downloadICS}>
                <Download size={14} /> Download .ics
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
            {editable ? 'Dot = day has hours set' : 'Open day'}
          </span>
          <span>
            {editable
              ? 'Tap hours to open or block segments · booked slots stay locked'
              : 'Hours: contiguous open slots · Days: every day in range must be open'}
          </span>
        </div>
      </div>
    </div>
  )
}