import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { readMockJson, writeMockJson } from '../lib/artistProfile'
import { getInviteBaseUrl } from '../lib/siteUrl'
import { resolveApiOrigin } from '../lib/apiBaseUrl'

export const INVITE_SESSION_KEY = 'artist_invite_token'
export const MOCK_INVITES_KEY = 'mock_artist_invites'

function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  }
  return `inv${Date.now()}${Math.random().toString(36).slice(2, 12)}`
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

const INVITE_REQUEST_TIMEOUT_MS = 10000

function getApiBaseUrl() {
  return resolveApiOrigin()
}

/** Read ?invite= from React Router params or window.location (SPA rewrite fallback). */
export function readInviteTokenFromUrl(searchParams) {
  const fromRouter = searchParams?.get?.('invite')?.trim()
  if (fromRouter) return fromRouter
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('invite')?.trim() || null
  }
  return null
}

async function validateArtistInviteViaApi(token) {
  const baseUrl = getApiBaseUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), INVITE_REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(
      `${baseUrl}/api/invites/validate?token=${encodeURIComponent(token.trim())}`,
      { signal: controller.signal, headers: { Accept: 'application/json' } }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        valid: false,
        reason: 'invalid',
        errorMessage: data.errorMessage || data.error || `Server error (${res.status})`,
      }
    }
    return normalizeValidation(data)
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Invite verification timed out. Check your connection and try again.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function buildInviteUrl(token) {
  return `${getInviteBaseUrl()}/apply?invite=${token}`
}

function normalizeInvite(row) {
  if (!row) return null
  return {
    id: row.id,
    token: row.token,
    artistName: row.artist_name ?? row.artistName,
    email: row.email,
    note: row.note,
    createdBy: row.created_by ?? row.createdBy,
    expiresAt: row.expires_at ?? row.expiresAt,
    usedAt: row.used_at ?? row.usedAt,
    usedByProfileId: row.used_by_profile_id ?? row.usedByProfileId,
    applicationId: row.application_id ?? row.applicationId,
    createdAt: row.created_at ?? row.createdAt,
  }
}

function normalizeValidation(data) {
  if (!data) return { valid: false, reason: 'invalid' }
  const valid = Boolean(data.valid)
  return {
    valid,
    reason: data.reason || (valid ? null : 'invalid'),
    artistName: data.artist_name ?? data.artistName ?? null,
    email: data.email ?? null,
    inviteId: data.invite_id ?? data.inviteId ?? null,
  }
}

export function persistInviteToken(token) {
  if (token) sessionStorage.setItem(INVITE_SESSION_KEY, token)
}

export function getStoredInviteToken() {
  return sessionStorage.getItem(INVITE_SESSION_KEY)
}

export function clearStoredInviteToken() {
  sessionStorage.removeItem(INVITE_SESSION_KEY)
}

export async function validateArtistInvite(token) {
  const trimmed = token?.trim()
  if (!trimmed) {
    return { valid: false, reason: 'missing' }
  }

  if (!isSupabaseConfigured) {
    const invites = readMockJson(MOCK_INVITES_KEY, [])
    const invite = invites.find((i) => i.token === trimmed)
    if (!invite) return { valid: false, reason: 'invalid' }
    if (invite.usedAt) return { valid: false, reason: 'used' }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return { valid: false, reason: 'expired' }
    }
    return {
      valid: true,
      reason: null,
      artistName: invite.artistName,
      email: invite.email,
      inviteId: invite.id,
    }
  }

  let rpcResult = null

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('validate_artist_invite', { p_token: trimmed }),
      INVITE_REQUEST_TIMEOUT_MS,
      'Invite verification timed out. Check your connection and try again.'
    )

    if (error) {
      console.error('validate_artist_invite:', error.message)
      rpcResult = { valid: false, reason: 'invalid', errorMessage: error.message }
    } else {
      rpcResult = normalizeValidation(data)
      if (rpcResult.valid || rpcResult.reason !== 'invalid') {
        return rpcResult
      }
    }
  } catch (err) {
    rpcResult = {
      valid: false,
      reason: 'invalid',
      errorMessage: err.message || 'Could not verify invite link',
    }
  }

  try {
    const apiResult = await validateArtistInviteViaApi(trimmed)
    if (apiResult.valid || apiResult.reason !== 'invalid') {
      return apiResult
    }
    return {
      ...apiResult,
      errorMessage: apiResult.errorMessage || rpcResult?.errorMessage,
    }
  } catch (apiErr) {
    console.warn('Invite API validation failed:', apiErr.message)
    return rpcResult || {
      valid: false,
      reason: 'invalid',
      errorMessage: apiErr.message || 'Could not verify invite link',
    }
  }
}

export async function consumeArtistInvite({ token, profileId, applicationId, email }) {
  if (!token) {
    return { error: { message: 'Invite token is required' } }
  }

  if (!isSupabaseConfigured) {
    const invites = readMockJson(MOCK_INVITES_KEY, [])
    const idx = invites.findIndex((i) => i.token === token)
    if (idx === -1) return { error: { message: 'Invalid invite' } }

    const invite = invites[idx]
    if (invite.usedAt) return { error: { message: 'Invite already used' } }
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return { error: { message: 'This invite is reserved for a different email address' } }
    }

    invites[idx] = {
      ...invite,
      usedAt: new Date().toISOString(),
      usedByProfileId: profileId,
      applicationId,
    }
    writeMockJson(MOCK_INVITES_KEY, invites)
    return { error: null }
  }

  const { error } = await supabase.rpc('consume_artist_invite', {
    p_token: token,
    p_profile_id: profileId,
    p_application_id: applicationId,
    p_email: email,
  })

  return { error }
}

export function useArtistInvite(token) {
  const trimmedToken = token?.trim() || null
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(!!trimmedToken)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!trimmedToken) {
        if (!cancelled) {
          setInvite(null)
          setError(null)
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setLoading(true)
        setError(null)
      }

      try {
        const result = await validateArtistInvite(trimmedToken)
        if (cancelled) return

        setInvite(result)
        if (result.errorMessage && !result.valid) {
          setError(result.errorMessage)
        } else {
          setError(null)
        }
      } catch (err) {
        if (cancelled) return
        setInvite({ valid: false, reason: 'invalid' })
        setError(err.message || 'Could not verify invite link')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [trimmedToken])

  return { invite, loading, error }
}

export function useAdminInvites(enabled) {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return

    if (!silent) {
      setLoading(true)
    }
    setError(null)

    if (!isSupabaseConfigured) {
      setInvites(readMockJson(MOCK_INVITES_KEY, []))
      if (!silent) setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await withTimeout(
        supabase.from('artist_invites').select('*').order('created_at', { ascending: false }),
        INVITE_REQUEST_TIMEOUT_MS,
        'Loading invites timed out. Check your connection and refresh.'
      )

      if (fetchError) throw fetchError
      setInvites((data || []).map(normalizeInvite))
    } catch (err) {
      setError(err.message)
      if (!silent) setInvites([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { invites, loading, error, refetch }
}

async function createArtistInviteViaRpc({ artistName, email, note, expiresDays }) {
  const { data, error } = await withTimeout(
    supabase.rpc('create_artist_invite', {
      p_artist_name: artistName?.trim() || null,
      p_email: email?.trim().toLowerCase() || null,
      p_note: note?.trim() || null,
      p_expires_days: expiresDays,
    }),
    INVITE_REQUEST_TIMEOUT_MS,
    'Creating invite timed out. Check your connection and try again.'
  )

  if (error) return { data: null, error }
  if (!data) {
    return { data: null, error: { message: 'Invite may have been created — refresh the list.' } }
  }
  return { data: normalizeInvite(data), error: null }
}

async function createArtistInviteViaDirectInsert({ artistName, email, note, expiresDays }) {
  const safeDays = Math.max(Number(expiresDays) || 30, 1)
  const expiresAt = new Date(Date.now() + safeDays * 86400000).toISOString()
  const token = generateToken()

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id ?? null

  const payload = {
    token,
    artist_name: artistName?.trim() || null,
    email: email?.trim().toLowerCase() || null,
    note: note?.trim() || null,
    expires_at: expiresAt,
    ...(userId ? { created_by: userId } : {}),
  }

  const { data, error } = await withTimeout(
    supabase.from('artist_invites').insert(payload).select().single(),
    INVITE_REQUEST_TIMEOUT_MS,
    'Creating invite timed out. Check your connection and try again.'
  )

  if (error) return { data: null, error }
  if (!data?.token) {
    return { data: null, error: { message: 'Invite created but response was incomplete. Refresh the list.' } }
  }
  return { data: normalizeInvite(data), error: null }
}

export async function createArtistInvite({ artistName, email, note, expiresDays = 30 }) {
  if (!isSupabaseConfigured) {
    const token = generateToken()
    const invite = {
      id: `mock-inv-${Date.now()}`,
      token,
      artistName: artistName?.trim() || null,
      email: email?.trim().toLowerCase() || null,
      note: note?.trim() || null,
      expiresAt: new Date(Date.now() + expiresDays * 86400000).toISOString(),
      usedAt: null,
      usedByProfileId: null,
      applicationId: null,
      createdAt: new Date().toISOString(),
    }

    const invites = readMockJson(MOCK_INVITES_KEY, [])
    writeMockJson(MOCK_INVITES_KEY, [invite, ...invites])
    return { data: invite, error: null }
  }

  const safeDays = Math.max(Number(expiresDays) || 30, 1)

  try {
    const rpcResult = await createArtistInviteViaRpc({ artistName, email, note, expiresDays: safeDays })
    if (!rpcResult.error && rpcResult.data?.token) {
      return rpcResult
    }

    const rpcFailed =
      rpcResult.error &&
      (rpcResult.error.code === '42883' ||
        /function.*does not exist/i.test(rpcResult.error.message || '') ||
        /uuid_generate_v4/i.test(rpcResult.error.message || ''))

    if (!rpcFailed) {
      return rpcResult
    }

    return createArtistInviteViaDirectInsert({ artistName, email, note, expiresDays: safeDays })
  } catch (err) {
    return { data: null, error: { message: err.message || 'Failed to create invite' } }
  }
}

export async function deleteArtistInvite(inviteId) {
  if (!inviteId) {
    return { error: { message: 'Invite id is required' } }
  }

  if (!isSupabaseConfigured) {
    const invites = readMockJson(MOCK_INVITES_KEY, [])
    writeMockJson(MOCK_INVITES_KEY, invites.filter((i) => i.id !== inviteId))
    return { error: null }
  }

  const { error } = await supabase.from('artist_invites').delete().eq('id', inviteId)
  return { error }
}

export function inviteStatus(invite) {
  if (!invite) return 'unknown'
  if (invite.usedAt) return 'used'
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return 'expired'
  return 'active'
}

export function needsInviteForApplication(application, artist) {
  if (artist) return false
  if (!application) return true
  if (application.status === 'rejected') return true
  return false
}
