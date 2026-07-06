import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  MOCK_ARTIST_PROFILE_KEY,
  formToArtistPayload,
  parseCommaList,
  readMockJson,
  writeMockJson,
} from '../lib/artistProfile'

async function syncSkillNames(artistId, skillNames) {
  const names = skillNames.map((s) => s.trim()).filter(Boolean)
  await supabase.from('artist_skills').delete().eq('artist_id', artistId)

  for (const name of names) {
    const { data: skillRow } = await supabase
      .from('skills')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single()

    if (skillRow?.id) {
      await supabase.from('artist_skills').upsert(
        { artist_id: artistId, skill_id: skillRow.id },
        { onConflict: 'artist_id,skill_id' }
      )
    }
  }
}

async function syncBrandNames(artistId, brandNames) {
  const names = brandNames.map((s) => s.trim()).filter(Boolean)
  await supabase.from('artist_brands').delete().eq('artist_id', artistId)

  for (const name of names) {
    const { data: brandRow } = await supabase
      .from('brands')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single()

    if (brandRow?.id) {
      await supabase.from('artist_brands').upsert(
        { artist_id: artistId, brand_id: brandRow.id },
        { onConflict: 'artist_id,brand_id' }
      )
    }
  }
}

function normalizeArtist(row, skills = [], brands = []) {
  if (!row) return null
  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name,
    roleTitle: row.role_title,
    bio: row.bio,
    location: row.location,
    hourlyRate: row.hourly_rate,
    dailyRate: row.day_rate ?? undefined,
    projectFlatRate: row.project_flat_rate ?? undefined,
    website: row.website,
    twitter: row.twitter,
    instagram: row.instagram,
    linkedin: row.linkedin,
    videoLinks: row.video_links || [],
    skills,
    brands,
    stripeAccountId: row.stripe_account_id ?? null,
    available: row.available,
    rating: row.rating,
    totalProjects: row.total_projects,
  }
}

export function useArtistProfile(profileId) {
  const [artist, setArtist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!profileId) {
      setArtist(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (!isSupabaseConfigured) {
      const mock = readMockJson(MOCK_ARTIST_PROFILE_KEY, null)
      setArtist(mock?.profileId === profileId ? mock : null)
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('artists')
        .select(`
          *,
          skills:artist_skills(skill:skills(name)),
          brands:artist_brands(brand:brands(name))
        `)
        .eq('profile_id', profileId)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (!data) {
        setArtist(null)
        return
      }

      setArtist(
        normalizeArtist(
          data,
          data.skills?.map((s) => s.skill?.name).filter(Boolean) || [],
          data.brands?.map((b) => b.brand?.name).filter(Boolean) || []
        )
      )
    } catch (err) {
      setError(err.message)
      setArtist(null)
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { artist, loading, error, refetch }
}

export async function saveArtistProfile({ profileId, fullName, form, existingArtist }) {
  const artistPayload = formToArtistPayload({ ...form, fullName })

  if (!isSupabaseConfigured) {
    const saved = {
      id: existingArtist?.id || `mock-artist-${Date.now()}`,
      profileId,
      displayName: fullName,
      roleTitle: artistPayload.role_title,
      bio: artistPayload.bio,
      location: artistPayload.location,
      hourlyRate: artistPayload.hourly_rate,
      website: artistPayload.website,
      twitter: artistPayload.twitter,
      instagram: artistPayload.instagram,
      linkedin: artistPayload.linkedin,
      videoLinks: artistPayload.video_links,
      skills: parseCommaList(form.skills),
      brands: parseCommaList(form.brands),
    }
    writeMockJson(MOCK_ARTIST_PROFILE_KEY, saved)
    return { data: saved, error: null }
  }

  const profileUpdate = supabase
    .from('profiles')
    .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
    .eq('id', profileId)

  if (!existingArtist?.id) {
    const { error: profileError } = await profileUpdate
    return { data: null, error: profileError || { message: 'Artist profile not found. Complete application approval first.' } }
  }

  const { data: artistRow, error: artistError } = await supabase
    .from('artists')
    .update(artistPayload)
    .eq('id', existingArtist.id)
    .select()
    .single()

  if (artistError) {
    return { data: null, error: artistError }
  }

  await syncSkillNames(existingArtist.id, parseCommaList(form.skills))
  await syncBrandNames(existingArtist.id, parseCommaList(form.brands))

  const { error: profileError } = await profileUpdate
  if (profileError) {
    return { data: null, error: profileError }
  }

  return {
    data: normalizeArtist(artistRow, parseCommaList(form.skills), parseCommaList(form.brands)),
    error: null,
  }
}

export async function fetchArtistByProfileId(profileId) {
  if (!isSupabaseConfigured) {
    const mock = readMockJson(MOCK_ARTIST_PROFILE_KEY, null)
    return mock?.profileId === profileId ? mock : null
  }

  const { data } = await supabase
    .from('artists')
    .select('id, profile_id, display_name')
    .eq('profile_id', profileId)
    .maybeSingle()

  return data
    ? { id: data.id, profileId: data.profile_id, displayName: data.display_name }
    : null
}
