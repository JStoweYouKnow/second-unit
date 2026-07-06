import { useState, useEffect, useCallback } from 'react'
import { disputes as disputesApi } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'

export function useDisputes(enabled = true) {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!enabled || !isSupabaseConfigured) {
      setDisputes([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await disputesApi.list()
      setDisputes(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load disputes')
      setDisputes([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  const openDispute = useCallback(async (payload) => {
    const created = await disputesApi.create(payload)
    setDisputes((prev) => [created, ...prev])
    return created
  }, [])

  const addEvidence = useCallback(async (disputeId, payload) => {
    const result = await disputesApi.addEvidence(disputeId, payload)
    if (result?.dispute) {
      setDisputes((prev) => prev.map((d) => (d.id === disputeId ? result.dispute : d)))
    }
    return result
  }, [])

  const resolveDispute = useCallback(async (disputeId, payload) => {
    const resolved = await disputesApi.resolve(disputeId, payload)
    setDisputes((prev) => prev.map((d) => (d.id === disputeId ? resolved : d)))
    return resolved
  }, [])

  return { disputes, loading, error, refetch, openDispute, addEvidence, resolveDispute }
}
