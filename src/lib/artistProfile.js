import { normalizeSocialUrl } from './socialLinks.js'
import { videoReelsToFormRows, videoReelsToPayload } from './videoReels.js'

/** @typedef {import('./artistProfileTypes').ArtistFormData} ArtistFormData */

export const APPLICATION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const MOCK_APPLICATION_KEY = 'mock_artist_application'
export const MOCK_ARTIST_PROFILE_KEY = 'mock_artist_profile'
export const MOCK_APPLICATIONS_QUEUE_KEY = 'mock_applications_queue'

export function parseCommaList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item?.name || ''))
      .map((s) => String(s).trim())
      .filter(Boolean)
  }
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinCommaList(items) {
  if (typeof items === 'string') return items
  if (!Array.isArray(items)) return ''
  return items
    .map((item) => (typeof item === 'string' ? item : item?.name || ''))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(', ')
}

export function emptyArtistForm() {
  return {
    fullName: '',
    email: '',
    password: '',
    roleTitle: '',
    bio: '',
    location: '',
    hourlyRate: '',
    dailyRate: '',
    projectFlatRate: '',
    skills: '',
    brands: '',
    website: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    videoLinks: videoReelsToFormRows([]),
  }
}

export function applicationToForm(app) {
  if (!app) return emptyArtistForm()
  return {
    fullName: app.full_name || app.fullName || '',
    email: app.email || '',
    password: '',
    roleTitle: app.role_title || app.roleTitle || '',
    bio: app.bio || '',
    location: app.location || '',
    hourlyRate: app.hourly_rate != null ? String(app.hourly_rate) : '',
    dailyRate: app.day_rate != null ? String(app.day_rate) : '',
    projectFlatRate: app.project_flat_rate != null ? String(app.project_flat_rate) : '',
    skills: joinCommaList(app.skills),
    brands: joinCommaList(app.brands),
    website: app.website || '',
    twitter: app.twitter || '',
    instagram: app.instagram || '',
    linkedin: app.linkedin || '',
    videoLinks: videoReelsToFormRows(app.video_reels || app.video_links || app.videoLinks),
  }
}

export function artistRecordToForm(artist) {
  if (!artist) return emptyArtistForm()
  return {
    fullName: artist.display_name || artist.displayName || '',
    email: '',
    password: '',
    roleTitle: artist.role_title || artist.roleTitle || '',
    bio: artist.bio || '',
    location: artist.location || '',
    hourlyRate: artist.hourly_rate != null ? String(artist.hourly_rate) : '',
    dailyRate: artist.day_rate != null ? String(artist.day_rate) : (artist.dailyRate != null ? String(artist.dailyRate) : ''),
    projectFlatRate: artist.project_flat_rate != null ? String(artist.project_flat_rate) : (artist.projectFlatRate != null ? String(artist.projectFlatRate) : ''),
    skills: joinCommaList(artist.skills),
    brands: joinCommaList(
      (artist.brands || []).map((b) => (typeof b === 'string' ? b : b?.name)).filter(Boolean)
    ),
    website: artist.website || '',
    twitter: artist.twitter || '',
    instagram: artist.instagram || '',
    linkedin: artist.linkedin || '',
    videoLinks: videoReelsToFormRows(artist.video_reels || artist.video_links || artist.videoLinks),
  }
}

export function formToApplicationPayload(form, profileId, email) {
  // Only columns on artist_applications (see supabase/artist-applications.sql).
  const videoPayload = videoReelsToPayload(form.videoLinks)
  return {
    profile_id: profileId,
    email,
    full_name: form.fullName.trim(),
    role_title: form.roleTitle.trim(),
    bio: form.bio.trim() || null,
    location: form.location.trim() || null,
    hourly_rate: 0,
    skills: parseCommaList(form.skills),
    brands: parseCommaList(form.brands),
    website: normalizeSocialUrl(form.website, 'website'),
    twitter: normalizeSocialUrl(form.twitter, 'twitter'),
    instagram: normalizeSocialUrl(form.instagram, 'instagram'),
    linkedin: normalizeSocialUrl(form.linkedin, 'linkedin'),
    video_links: videoPayload.video_links,
    video_reels: videoPayload.video_reels,
    status: APPLICATION_STATUSES.PENDING,
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  }
}

export function formToArtistPayload(form) {
  const videoPayload = videoReelsToPayload(form.videoLinks)
  return {
    display_name: form.fullName.trim(),
    role_title: form.roleTitle.trim(),
    bio: form.bio.trim() || null,
    location: form.location.trim() || null,
    website: normalizeSocialUrl(form.website, 'website'),
    twitter: normalizeSocialUrl(form.twitter, 'twitter'),
    instagram: normalizeSocialUrl(form.instagram, 'instagram'),
    linkedin: normalizeSocialUrl(form.linkedin, 'linkedin'),
    video_links: videoPayload.video_links,
    video_reels: videoPayload.video_reels,
    updated_at: new Date().toISOString(),
  }
}

export function readMockJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeMockJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
