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
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinCommaList(items) {
  if (!Array.isArray(items)) return ''
  return items.filter(Boolean).join(', ')
}

export function parseVideoLinks(value) {
  return parseCommaList(value)
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
    videoLinks: '',
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
    videoLinks: joinCommaList(app.video_links || app.videoLinks),
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
    videoLinks: joinCommaList(artist.video_links || artist.videoLinks),
  }
}

export function formToApplicationPayload(form, profileId, email) {
  return {
    profile_id: profileId,
    email,
    full_name: form.fullName.trim(),
    role_title: form.roleTitle.trim(),
    bio: form.bio.trim() || null,
    location: form.location.trim() || null,
    hourly_rate: form.hourlyRate ? parseInt(form.hourlyRate, 10) || 0 : 0,
    day_rate: form.dailyRate ? parseInt(form.dailyRate, 10) || null : null,
    project_flat_rate: form.projectFlatRate ? parseInt(form.projectFlatRate, 10) || null : null,
    skills: parseCommaList(form.skills),
    brands: parseCommaList(form.brands),
    website: form.website.trim() || null,
    twitter: form.twitter.trim() || null,
    instagram: form.instagram.trim() || null,
    linkedin: form.linkedin.trim() || null,
    video_links: parseVideoLinks(form.videoLinks),
    status: APPLICATION_STATUSES.PENDING,
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  }
}

export function formToArtistPayload(form) {
  return {
    display_name: form.fullName.trim(),
    role_title: form.roleTitle.trim(),
    bio: form.bio.trim() || null,
    location: form.location.trim() || null,
    hourly_rate: form.hourlyRate ? parseInt(form.hourlyRate, 10) || 0 : 0,
    day_rate: form.dailyRate ? parseInt(form.dailyRate, 10) || null : null,
    project_flat_rate: form.projectFlatRate ? parseInt(form.projectFlatRate, 10) || null : null,
    website: form.website.trim() || null,
    twitter: form.twitter.trim() || null,
    instagram: form.instagram.trim() || null,
    linkedin: form.linkedin.trim() || null,
    video_links: parseVideoLinks(form.videoLinks),
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
