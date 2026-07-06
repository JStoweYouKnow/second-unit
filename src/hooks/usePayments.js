import { useState, useEffect, useCallback } from 'react'
import { payments as paymentsApi } from '../lib/api'

export function usePayments(enabled = true) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!enabled) {
      setPayments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await paymentsApi.list()
      setPayments(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load payments')
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { payments, loading, error, refetch }
}
