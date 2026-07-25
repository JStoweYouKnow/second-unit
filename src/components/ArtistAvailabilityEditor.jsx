import { useState, useEffect, useMemo } from 'react'
import {
  format,
  isSameDay,
} from 'date-fns'
import { Clock, Loader2, CheckCircle, Plus } from './icons'
import { useArtistAvailability } from '../hooks/useArtistAvailability'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  STANDARD_SLOT_LABELS,
  SLOT_PRESETS,
  isPastDate,
  buildForwardWeeks,
  sortSlotLabels,
  detectBrowserTimeZone,
  listTimeZones,
  formatTimeZoneLabel,
} from '../lib/availability'

export default function ArtistAvailabilityEditor({
  artistId,
  artistName,
  initialTimeZone = null,
  onTimeZoneChange,
}) {
  const { availability, loading, saving, error, updateDayAvailability } = useArtistAvailability(artistId)
  const [weeksToShow, setWeeksToShow] = useState(6)
  const [selectedDate, setSelectedDate] = useState(null)
  const [draftSlots, setDraftSlots] = useState([])
  const [saveStatus, setSaveStatus] = useState('')
  const [timeZone, setTimeZone] = useState(initialTimeZone || detectBrowserTimeZone())
  const [tzSaving, setTzSaving] = useState(false)
  const [tzStatus, setTzStatus] = useState('')

  const timeZones = useMemo(() => listTimeZones(), [])

  useEffect(() => {
    if (initialTimeZone) setTimeZone(initialTimeZone)
  }, [initialTimeZone])

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

  const { weekdayLabels, weeks } = useMemo(
    () => buildForwardWeeks(weeksToShow, { timeZone }),
    [weeksToShow, timeZone]
  )

  const rangeLabel = useMemo(() => {
    if (!weeks.length) return ''
    const first = weeks[0][0].date
    const last = weeks[weeks.length - 1][6].date
    const sameYear = first.getFullYear() === last.getFullYear()
    return `${format(first, 'MMM d')} – ${format(last, sameYear ? 'MMM d, yyyy' : 'MMM d, yyyy')}`
  }, [weeks])

  const persistTimeZone = async (nextTz) => {
    setTimeZone(nextTz)
    setTzStatus('')
    if (!artistId || !isSupabaseConfigured || !supabase) {
      onTimeZoneChange?.(nextTz)
      return
    }
    setTzSaving(true)
    try {
      const { error: tzErr } = await supabase
        .from('artists')
        .update({ timezone: nextTz, updated_at: new Date().toISOString() })
        .eq('id', artistId)
      if (tzErr) throw tzErr
      onTimeZoneChange?.(nextTz)
      setTzStatus('saved')
      setTimeout(() => setTzStatus(''), 2000)
    } catch (err) {
      setTzStatus(err.message || 'Could not save timezone')
    } finally {
      setTzSaving(false)
    }
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
            Set open hours in your working timezone. Clients book hour-long segments; booked slots stay locked.
          </p>
        </div>
        {loading && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={14} className="animate-spin" /> Loading…
          </span>
        )}
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="form-group" style={{ marginBottom: 20, maxWidth: 420 }}>
        <label className="form-label" htmlFor="artist-timezone">Working timezone</label>
        <select
          id="artist-timezone"
          className="form-input"
          value={timeZone}
          onChange={(e) => persistTimeZone(e.target.value)}
          disabled={tzSaving}
        >
          {!timeZones.includes(timeZone) && timeZone && (
            <option value={timeZone}>{formatTimeZoneLabel(timeZone)}</option>
          )}
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>{formatTimeZoneLabel(tz)}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
          Past dates are hidden using this timezone. Hours you set are wall-clock times in {formatTimeZoneLabel(timeZone)}.
          {tzSaving && ' Saving…'}
          {tzStatus === 'saved' && ' Saved.'}
          {tzStatus && tzStatus !== 'saved' && (
            <span style={{ color: 'var(--danger)' }}> {tzStatus}</span>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: 16 }}>
          {rangeLabel}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From today forward</span>
      </div>

      <div className="calendar-grid" style={{ marginBottom: 4 }}>
        {weekdayLabels.map((d, i) => (
          <div key={`${d}-${i}`} className="calendar-header">{d}</div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0].dateKey} className="calendar-grid">
          {week.map((cell) => {
            if (cell.hide) {
              return (
                <div
                  key={cell.dateKey}
                  className="calendar-day"
                  style={{ visibility: 'hidden', pointerEvents: 'none' }}
                  aria-hidden
                />
              )
            }

            const hasSlots = availableDates.includes(cell.dateKey)
            const isSelected = selectedDate && isSameDay(cell.date, selectedDate)
            const disabled = cell.past || !cell.inMonth

            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled={disabled}
                className={`calendar-day ${!cell.inMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''} ${hasSlots ? 'has-event' : ''} ${isSelected ? 'calendar-day--selected' : ''}`}
                onClick={() => {
                  if (disabled) return
                  setSelectedDate(cell.date)
                  setSaveStatus('')
                }}
                style={{
                  opacity: !cell.inMonth ? 0.35 : 1,
                  cursor: disabled ? 'default' : 'pointer',
                  border: 'none',
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? 'var(--paper)' : undefined,
                }}
                aria-label={format(cell.date, 'EEEE, MMMM d, yyyy')}
                aria-pressed={isSelected}
              >
                {format(cell.date, 'd')}
              </button>
            )
          })}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setWeeksToShow((w) => w + 4)}
        >
          <Plus size={14} /> Show more weeks
        </button>
      </div>

      {selectedDate && !isPastDate(selectedDate, timeZone) && (
        <div className="slide-up" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 13 }}>
              · {formatTimeZoneLabel(timeZone)}
            </span>
          </h3>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(SLOT_PRESETS.fullDay)}>
              Full day (24h)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(SLOT_PRESETS.business)}>
              Business (9 AM – 5 PM)
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
              Clear unbooked slots
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
            Tap hours to open them for booking. Leave hours off to block that segment of the day.
          </p>

          <div
            className="availability-slot-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 8,
              marginBottom: 20,
              maxHeight: 280,
              overflowY: 'auto',
              paddingRight: 4,
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
                  onClick={() => toggleSlot(slot)}
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
          Dot = day has availability · Past dates hidden · Booked slots stay locked
        </span>
      </div>
    </div>
  )
}
