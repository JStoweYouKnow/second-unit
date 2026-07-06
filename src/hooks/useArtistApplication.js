import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  APPLICATION_STATUSES,
  MOCK_APPLICATION_KEY,
  MOCK_APPLICATIONS_QUEUE_KEY,
  formToApplicationPayload,
  readMockJson,
  writeMockJson,
} from '../lib/artistProfile'
import {
  validateArtistInvite,
  consumeArtistInvite,
  getStoredInviteToken,
  clearStoredInviteToken,
  needsInviteForApplication,
} from './useArtistInvites'

export const PENDING_APPLY_KEY = 'pending_artist_application'

function normalizeApplication(row) {
  if (!row) return null
  return {
    id: row.id,
    profileId: row.profile_id,
    email: row.email,
    fullName: row.full_name,
    roleTitle: row.role_title,
    bio: row.bio,
    location: row.location,
    hourlyRate: row.hourly_rate,
    skills: row.skills || [],
    brands: row.brands || [],
    website: row.website,
    twitter: row.twitter,
    instagram: row.instagram,
    linkedin: row.linkedin,
    videoLinks: row.video_links || [],
    status: row.status,
    rejectionReason: row.rejection_reason,
    adminNotes: row.admin_notes,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useMyApplication(profileId) {
  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!profileId) {
      setApplication(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured) {
      const mock = readMockJson(MOCK_APPLICATION_KEY, null)
      setApplication(mock?.profileId === profileId ? mock : null)
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('artist_applications')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()

      if (fetchError) throw fetchError
      setApplication(normalizeApplication(data))
    } catch (err) {
      setError(err.message)
      setApplication(null)
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { application, loading, error, refetch }
}

/**
 * Submit a deferred application saved during sign-up (before email confirmation).
 * Safe to call after any successful login once profile.id is available.
 */
export async function flushPendingArtistApplication({ profileId, email }) {
  if (!profileId) return { flushed: false, error: null, application: null }

  const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PENDING_APPLY_KEY) : null
  if (!raw) return { flushed: false, error: null, application: null }

  let existingApplication = null
  if (!isSupabaseConfigured) {
    const mock = readMockJson(MOCK_APPLICATION_KEY, null)
    if (mock?.profileId === profileId) existingApplication = mock
  } else {
    const { data } = await supabase
      .from('artist_applications')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle()
    existingApplication = normalizeApplication(data)
  }

  if (existingApplication) {
    sessionStorage.removeItem(PENDING_APPLY_KEY)
    return { flushed: false, error: null, application: existingApplication }
  }

  const storedToken = getStoredInviteToken()
  if (needsInviteForApplication(null, null) && !storedToken) {
    return { flushed: false, error: null, application: null }
  }

  try {
    const pendingForm = JSON.parse(raw)
    const { data, error: submitError } = await submitArtistApplication({
      form: pendingForm,
      profileId,
      email: email || pendingForm.email,
      existingApplication: null,
      inviteToken: storedToken,
    })

    if (submitError) {
      return { flushed: false, error: submitError, application: null }
    }

    sessionStorage.removeItem(PENDING_APPLY_KEY)
    clearStoredInviteToken()
    return { flushed: true, error: null, application: data }
  } catch (err) {
    return { flushed: false, error: { message: err.message || 'Failed to submit pending application' }, application: null }
  }
}

export async function submitArtistApplication({ form, profileId, email, existingApplication, inviteToken }) {
  const payload = formToApplicationPayload(form, profileId, email)
  const requiresInvite = !existingApplication || existingApplication.status === 'rejected'

  if (requiresInvite && inviteToken) {
    const validation = await validateArtistInvite(inviteToken)
    if (!validation.valid) {
      return { data: null, error: { message: 'Your invite link is invalid or expired. Request a new one from The Callsheet team.' } }
    }
    if (validation.email && validation.email.toLowerCase() !== email.toLowerCase()) {
      return { data: null, error: { message: 'This invite is reserved for a different email address.' } }
    }
  } else if (requiresInvite && !inviteToken) {
    return { data: null, error: { message: 'A private invite link is required to apply.' } }
  }

  if (!isSupabaseConfigured) {
    const app = {
      id: existingApplication?.id || `mock-app-${Date.now()}`,
      profileId,
      email,
      fullName: payload.full_name,
      roleTitle: payload.role_title,
      bio: payload.bio,
      location: payload.location,
      hourlyRate: payload.hourly_rate,
      skills: payload.skills,
      brands: payload.brands,
      website: payload.website,
      twitter: payload.twitter,
      instagram: payload.instagram,
      linkedin: payload.linkedin,
      videoLinks: payload.video_links,
      status: APPLICATION_STATUSES.PENDING,
      rejectionReason: null,
      createdAt: existingApplication?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    writeMockJson(MOCK_APPLICATION_KEY, app)

    const queue = readMockJson(MOCK_APPLICATIONS_QUEUE_KEY, [])
    const nextQueue = [
      app,
      ...queue.filter((item) => item.profileId !== profileId),
    ]
    writeMockJson(MOCK_APPLICATIONS_QUEUE_KEY, nextQueue)

    if (inviteToken) {
      await consumeArtistInvite({ token: inviteToken, profileId, applicationId: app.id, email })
    }

    return { data: app, error: null }
  }

  let applicationId
  let resultData

  if (existingApplication?.id) {
    const { data, error } = await supabase
      .from('artist_applications')
      .update(payload)
      .eq('id', existingApplication.id)
      .select()
      .single()
    if (error) return { data: null, error }
    applicationId = data.id
    resultData = normalizeApplication(data)
  } else {
    const { data, error } = await supabase
      .from('artist_applications')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return { data: null, error }
    applicationId = data.id
    resultData = normalizeApplication(data)
  }

  if (inviteToken) {
    const { error: consumeError } = await consumeArtistInvite({
      token: inviteToken,
      profileId,
      applicationId,
      email,
    })
    if (consumeError) {
      return { data: null, error: consumeError }
    }
  }

  return { data: resultData, error: null }
}

export function useAdminApplications(enabled) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured) {
      setApplications(readMockJson(MOCK_APPLICATIONS_QUEUE_KEY, []))
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('artist_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setApplications((data || []).map(normalizeApplication))
    } catch (err) {
      setError(err.message)
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { applications, loading, error, refetch }
}

export async function approveApplication(applicationId) {
  if (!isSupabaseConfigured) {
    const queue = readMockJson(MOCK_APPLICATIONS_QUEUE_KEY, [])
    const app = queue.find((item) => item.id === applicationId)
    if (!app) return { error: { message: 'Application not found' } }

    const approved = { ...app, status: APPLICATION_STATUSES.APPROVED, reviewedAt: new Date().toISOString() }
    writeMockJson(MOCK_APPLICATION_KEY, approved)
    writeMockJson(
      MOCK_APPLICATIONS_QUEUE_KEY,
      queue.map((item) => (item.id === applicationId ? approved : item))
    )

    const artistProfile = readMockJson('mock_artist_profile', null) || {}
    writeMockJson('mock_artist_profile', {
      ...artistProfile,
      profileId: app.profileId,
      id: artistProfile.id || `mock-artist-${Date.now()}`,
      displayName: app.fullName,
      roleTitle: app.roleTitle,
      bio: app.bio,
      location: app.location,
      hourlyRate: app.hourlyRate,
      skills: app.skills,
      brands: app.brands,
      website: app.website,
      twitter: app.twitter,
      instagram: app.instagram,
      linkedin: app.linkedin,
      videoLinks: app.videoLinks,
    })

    localStorage.setItem('mock_user_role', 'artist')
    return { data: approved, error: null }
  }

  const { data, error } = await supabase.rpc('approve_artist_application', {
    p_application_id: applicationId,
  })

  return { data, error }
}

export async function rejectApplication(applicationId, reason) {
  if (!isSupabaseConfigured) {
    const queue = readMockJson(MOCK_APPLICATIONS_QUEUE_KEY, [])
    const app = queue.find((item) => item.id === applicationId)
    if (!app) return { error: { message: 'Application not found' } }

    const rejected = {
      ...app,
      status: APPLICATION_STATUSES.REJECTED,
      rejectionReason: reason || null,
      reviewedAt: new Date().toISOString(),
    }

    writeMockJson(MOCK_APPLICATION_KEY, rejected)
    writeMockJson(
      MOCK_APPLICATIONS_QUEUE_KEY,
      queue.map((item) => (item.id === applicationId ? rejected : item))
    )

    return { data: rejected, error: null }
  }

  const { error } = await supabase.rpc('reject_artist_application', {
    p_application_id: applicationId,
    p_reason: reason || null,
  })

  return { data: null, error }
}

export function isPendingApplicant(application) {
  return application?.status === APPLICATION_STATUSES.PENDING
}

export function isRejectedApplicant(application) {
  return application?.status === APPLICATION_STATUSES.REJECTED
}

export function isApprovedApplicant(application) {
  return application?.status === APPLICATION_STATUSES.APPROVED
}
