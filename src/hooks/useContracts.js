import { useState, useEffect, useCallback } from 'react'
import { contracts as contractsApi } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import { buildDefaultMilestones, canPayMilestone } from '../lib/milestones'

const MOCK_KEY = 'mock_contracts'

function loadMock() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) || '[]')
  } catch {
    return []
  }
}

function saveMock(list) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(list))
  } catch {}
}

function withMilestonesIfActive(contract) {
  if ((contract.status === 'active' || contract.status === 'completed') && !contract.milestones?.length) {
    return { ...contract, milestones: buildDefaultMilestones(contract.id, contract.value || 0) }
  }
  return contract
}

function updateMockContract(contractId, updater) {
  const list = loadMock()
  const next = list.map((c) => (c.id === contractId ? updater(c) : c))
  saveMock(next)
  return next
}

export function useContracts(enabled = true) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!enabled) {
      setContracts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (!isSupabaseConfigured) {
        const list = loadMock().map(withMilestonesIfActive)
        setContracts(list)
        return list
      }
      const data = await contractsApi.list()
      const list = Array.isArray(data) ? data : []
      setContracts(list)
      return list
    } catch (err) {
      setError(err.message || 'Failed to load projects')
      const fallback = isSupabaseConfigured ? [] : loadMock().map(withMilestonesIfActive)
      setContracts(fallback)
      return fallback
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  const upsertLocal = useCallback((updated) => {
    setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }, [])

  const createContract = useCallback(async (payload) => {
    if (!isSupabaseConfigured) {
      const bookingId = `bk_${Date.now()}`
      const project = withMilestonesIfActive({
        id: `pj_${Date.now()}`,
        status: 'pending',
        signedByEmployer: false,
        signedByArtist: false,
        employerSignature: null,
        artistSignature: null,
        milestones: [],
        bookingId,
        createdAt: new Date().toISOString(),
        ...payload,
      })
      try {
        const bookings = JSON.parse(localStorage.getItem('mock_bookings') || '[]')
        bookings.unshift({
          id: bookingId,
          artistId: payload.artistId,
          artistName: payload.artistName || 'Artist',
          date: payload.startDate || new Date().toISOString().slice(0, 10),
          time: '09:00',
          duration: 1,
          durationUnit: 'project',
          type: 'Project Work',
          agreedTotal: Math.round(Number(payload.value) || 0),
          status: 'pending',
          notes: `Created from project: ${payload.title}`,
          contractId: project.id,
          createdAt: new Date().toISOString(),
        })
        localStorage.setItem('mock_bookings', JSON.stringify(bookings))
      } catch {}
      const next = [project, ...loadMock()]
      saveMock(next)
      setContracts(next.map(withMilestonesIfActive))
      return project
    }

    const created = await contractsApi.create(payload)
    setContracts((prev) => [{ ...created, milestones: [] }, ...prev])
    return created
  }, [])

  const applySigned = useCallback((contractId, patch) => {
    if (!isSupabaseConfigured) {
      let signedContract = null
      const next = updateMockContract(contractId, (c) => {
        const updated = { ...c, ...patch }
        if (updated.signedByEmployer && updated.signedByArtist) {
          updated.status = 'active'
          updated.milestones = buildDefaultMilestones(updated.id, updated.value || 0)
        }
        signedContract = updated
        return updated
      })
      setContracts(next.map(withMilestonesIfActive))
      return signedContract
    }
    return null
  }, [])

  const signContract = useCallback(async (contractId, name) => {
    if (!isSupabaseConfigured) {
      return applySigned(contractId, {
        signedByEmployer: true,
        employerSignature: { name, date: new Date().toISOString() },
      })
    }

    const signed = await contractsApi.sign(contractId, name)
    upsertLocal(signed)
    return signed
  }, [applySigned, upsertLocal])

  const signContractAsArtist = useCallback(async (contractId, name) => {
    if (!isSupabaseConfigured) {
      return applySigned(contractId, {
        signedByArtist: true,
        artistSignature: { name, date: new Date().toISOString() },
      })
    }

    const signed = await contractsApi.sign(contractId, name)
    upsertLocal(signed)
    return signed
  }, [applySigned, upsertLocal])

  const payMilestone = useCallback(async (contractId, milestoneId) => {
    if (!isSupabaseConfigured) {
      let updatedContract = null
      const next = updateMockContract(contractId, (c) => {
        const milestones = (c.milestones || []).map((m) =>
          m.id === milestoneId ? { ...m, status: 'funded' } : m
        )
        updatedContract = { ...c, milestones }
        return updatedContract
      })
      setContracts(next)
      return { url: `${window.location.origin}/projects?milestone_paid=1&contract_id=${contractId}` }
    }

    return contractsApi.payMilestone(contractId, milestoneId)
  }, [])

  const approveMilestone = useCallback(async (contractId, milestoneId) => {
    if (!isSupabaseConfigured) {
      let updatedContract = null
      const next = updateMockContract(contractId, (c) => {
        const milestones = (c.milestones || []).map((m) =>
          m.id === milestoneId
            ? { ...m, status: 'released', releasedAt: new Date().toISOString() }
            : m
        )
        const allReleased = milestones.every((m) => m.status === 'released')
        updatedContract = {
          ...c,
          milestones,
          status: allReleased ? 'completed' : c.status,
        }
        return updatedContract
      })
      setContracts(next)
      return updatedContract?.milestones?.find((m) => m.id === milestoneId)
    }

    const released = await contractsApi.approveMilestone(contractId, milestoneId)
    await refetch()
    return released
  }, [refetch])

  return {
    contracts,
    loading,
    error,
    refetch,
    createContract,
    signContract,
    signContractAsArtist,
    payMilestone,
    approveMilestone,
  }
}
