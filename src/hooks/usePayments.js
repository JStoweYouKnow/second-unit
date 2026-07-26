import { useState, useEffect, useCallback, useRef } from 'react'
import { payments as paymentsApi } from '../lib/api'

function normalizePaymentRow(row) {
  if (!row || typeof row !== 'object') return null
  return {
    ...row,
    description: row.description || 'Payment',
    artistName: row.artistName || 'Artist',
    status: row.status || 'pending',
    amount: Number(row.amount) || 0,
  }
}

export function usePayments(enabled = true) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetchIdRef = useRef(0)

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const fetchId = ++fetchIdRef.current
    setLoading(true)
    setError(null)

    try {
      const data = await paymentsApi.list()
      if (fetchId !== fetchIdRef.current) return
      const rows = Array.isArray(data) ? data : []
      setPayments(rows.map(normalizePaymentRow).filter(Boolean))
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return
      setError(err.message || 'Failed to load payments')
      // Keep existing rows visible when a background refresh fails.
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false)
      }
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    refetch()
  }, [enabled, refetch])

  return { payments, loading, error, refetch }
}
