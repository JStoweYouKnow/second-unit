const REVIEWS_KEY = 'su_hirer_reviews'
const SETTINGS_KEY_PREFIX = 'su_artist_review_settings_'
const VISIBILITY_KEY_PREFIX = 'su_review_visibility_'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

/** @typedef {{ id: string, artistId: string|number, hirerId?: string, name: string, company?: string, rating: number, text: string, createdAt: string, source: 'hirer' }} StoredReview */

export function getArtistReviewSettings(artistId) {
  const stored = readJson(`${SETTINGS_KEY_PREFIX}${artistId}`, null)
  return {
    showReviewsOnProfile: stored?.showReviewsOnProfile !== false,
  }
}

export function setArtistReviewSettings(artistId, partial) {
  const current = getArtistReviewSettings(artistId)
  writeJson(`${SETTINGS_KEY_PREFIX}${artistId}`, { ...current, ...partial })
}

function getVisibilityMap(artistId) {
  return readJson(`${VISIBILITY_KEY_PREFIX}${artistId}`, {})
}

export function setReviewVisibleOnProfile(artistId, reviewId, visible) {
  const map = getVisibilityMap(artistId)
  map[reviewId] = visible
  writeJson(`${VISIBILITY_KEY_PREFIX}${artistId}`, map)
}

export function isReviewVisibleOnProfile(artistId, reviewId) {
  const map = getVisibilityMap(artistId)
  if (map[reviewId] === false) return false
  return true
}

function loadHirerReviews() {
  return /** @type {StoredReview[]} */ (readJson(REVIEWS_KEY, []))
}

function saveHirerReviews(reviews) {
  writeJson(REVIEWS_KEY, reviews)
}

export function getAllReviewsForArtist(artistId) {
  const idKey = String(artistId)
  return loadHirerReviews()
    .filter((r) => String(r.artistId) === idKey)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Reviews hirers may see on the artist profile.
 */
export function getPublicReviewsForArtist(artistId) {
  const settings = getArtistReviewSettings(artistId)
  if (!settings.showReviewsOnProfile) return []
  return getAllReviewsForArtist(artistId).filter((r) =>
    isReviewVisibleOnProfile(artistId, r.id)
  )
}

export function getAverageRating(reviews) {
  if (!reviews?.length) return null
  const sum = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

export function findHirerReview(artistId, hirerId) {
  if (!hirerId) return null
  return loadHirerReviews().find(
    (r) => String(r.artistId) === String(artistId) && r.hirerId === hirerId
  )
}

/**
 * @param {{ artistId: string|number, hirerId: string, hirerName: string, company?: string, rating: number, text: string }} input
 */
export function submitHirerReview(input) {
  const { artistId, hirerId, hirerName, company, rating, text } = input
  const all = loadHirerReviews()
  const existingIdx = all.findIndex(
    (r) => String(r.artistId) === String(artistId) && r.hirerId === hirerId
  )
  const review = {
    id: existingIdx >= 0 ? all[existingIdx].id : `rev-${Date.now()}`,
    artistId,
    hirerId,
    name: hirerName,
    company: (company || '').trim(),
    rating: Math.min(5, Math.max(1, Math.round(Number(rating)))),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    source: 'hirer',
  }
  if (existingIdx >= 0) {
    all[existingIdx] = { ...all[existingIdx], ...review, createdAt: all[existingIdx].createdAt }
  } else {
    all.push(review)
  }
  saveHirerReviews(all)
  return review
}
