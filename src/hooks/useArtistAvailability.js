import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { readMockJson, writeMockJson } from '../lib/artistProfile'
import {
  formatTime12h,
  groupSlotsByDate,
  labelToEndTime,
  labelToStartTime,
  normalizeDateKey,
  sortSlotLabels,
  STANDARD_SLOT_LABELS,
} from '../lib/availability'
import { applyGoogleBusyToAvailability } from '../lib/googleBusy'

const MOCK_AVAILABILITY_KEY = 'mock_availability_slots'

function readMockRows(artistId) {
  const all = readMockJson(MOCK_AVAILABILITY_KEY, {})
  return all[artistId] || []
}

function writeMockRows(artistId, rows) {
  const all = readMockJson(MOCK_AVAILABILITY_KEY, {})
  all[artistId] = rows
  writeMockJson(MOCK_AVAILABILITY_KEY, all)
}

export function useArtistAvailability(artistId) {
  const [rows, setRows] = useState([])
  const [busyRows, setBusyRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const availability = useMemo(() => {
    const grouped = groupSlotsByDate(rows)
    return applyGoogleBusyToAvailability(grouped, busyRows)
  }, [rows, busyRows])

  const refetch = useCallback(async () => {
    if (!artistId) {
      setRows([])
      setBusyRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured) {
      setRows(readMockRows(artistId))
      setBusyRows([])
      setLoading(false)
      return
    }

    try {
      const [{ data, error: fetchError }, { data: busy }] = await Promise.all([
        supabase
          .from('availability_slots')
          .select('*')
          .eq('artist_id', artistId)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('google_busy_blocks')
          .select('*')
          .eq('artist_id', artistId)
          .order('date', { ascending: true }),
      ])

      if (fetchError) throw fetchError
      setRows(data || [])
      setBusyRows(busy || [])
    } catch (err) {
      setError(err.message || 'Failed to load availability')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const updateDayAvailability = useCallback(
    async (dateStr, selectedLabels) => {
      if (!artistId || !dateStr) {
        return { error: { message: 'Artist and date are required' } }
      }

      const normalizedDate = normalizeDateKey(dateStr)
      const desired = sortSlotLabels(
        [...new Set((selectedLabels || []).filter((l) => STANDARD_SLOT_LABELS.includes(l)))]
      )

      const dayRows = rows.filter((r) => normalizeDateKey(r.date) === normalizedDate)
      const bookedLabels = dayRows
        .filter((r) => r.is_booked)
        .map((r) => formatTime12h(r.start_time))

      for (const booked of bookedLabels) {
        if (!desired.includes(booked)) {
          return {
            error: { message: `Cannot remove ${booked} — this slot is already booked.` },
          }
        }
      }

      setSaving(true)
      setError(null)

      if (!isSupabaseConfigured) {
        const otherDays = rows.filter((r) => normalizeDateKey(r.date) !== normalizedDate)
        const keptBooked = dayRows.filter((r) => r.is_booked)
        const newRows = desired
          .filter((label) => !keptBooked.some((r) => labelToStartTime(label) === String(r.start_time).slice(0, 8)))
          .map((label, idx) => ({
            id: `mock-slot-${normalizedDate}-${idx}`,
            artist_id: artistId,
            date: normalizedDate,
            start_time: labelToStartTime(label),
            end_time: labelToEndTime(label),
            is_booked: false,
          }))
        const next = [...otherDays, ...keptBooked, ...newRows]
        writeMockRows(artistId, next)
        setRows(next)
        setSaving(false)
        return { error: null }
      }

      try {
        const toDelete = dayRows.filter((r) => !r.is_booked).map((r) => r.id)
        if (toDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('availability_slots')
            .delete()
            .in('id', toDelete)
          if (deleteError) throw deleteError
        }

        const existingStarts = new Set(
          dayRows
            .filter((r) => r.is_booked)
            .map((r) => String(r.start_time).slice(0, 8))
        )

        const inserts = desired
          .filter((label) => !existingStarts.has(labelToStartTime(label)))
          .map((label) => ({
            artist_id: artistId,
            date: normalizedDate,
            start_time: labelToStartTime(label),
            end_time: labelToEndTime(label),
            is_booked: false,
          }))

        if (inserts.length > 0) {
          const { error: insertError } = await supabase.from('availability_slots').insert(inserts)
          if (insertError) throw insertError
        }

        await refetch()
        return { error: null }
      } catch (err) {
        const message = err.message || 'Failed to save availability'
        setError(message)
        return { error: { message } }
      } finally {
        setSaving(false)
      }
    },
    [artistId, rows, refetch]
  )

  return {
    rows,
    availability,
    loading,
    saving,
    error,
    refetch,
    updateDayAvailability,
  }
}
