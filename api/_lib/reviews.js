import { getArtistIdForProfile } from './bookings.js'

export function mapReviewToClient(row) {
  if (!row) return null
  return {
    id: row.id,
    artistId: row.reviewee_artist_id,
    hirerId: row.reviewer_id,
    name: row.reviewer_name ?? 'Client',
    company: row.reviewer_company ?? '',
    rating: row.rating,
    text: row.body ?? '',
    createdAt: row.created_at,
    visibleOnProfile: row.visible_on_profile !== false,
    source: 'hirer',
  }
}

export async function listReviewsForArtist(db, artistId, { publicOnly = false } = {}) {
  let query = db
    .from('reviews')
    .select('*')
    .eq('reviewee_artist_id', artistId)
    .order('created_at', { ascending: false })

  if (publicOnly) {
    query = query.eq('visible_on_profile', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapReviewToClient)
}

export async function upsertReview(db, reviewerId, payload) {
  const row = {
    reviewer_id: reviewerId,
    reviewee_artist_id: payload.artistId,
    rating: Math.min(5, Math.max(1, Math.round(Number(payload.rating)))),
    body: (payload.text || '').trim(),
    reviewer_name: payload.hirerName || payload.name || 'Client',
    reviewer_company: (payload.company || '').trim() || null,
    visible_on_profile: true,
  }

  const { data: existing } = await db
    .from('reviews')
    .select('id')
    .eq('reviewer_id', reviewerId)
    .eq('reviewee_artist_id', payload.artistId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await db
      .from('reviews')
      .update(row)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return mapReviewToClient(data)
  }

  const { data, error } = await db.from('reviews').insert(row).select().single()
  if (error) throw error
  return mapReviewToClient(data)
}

export async function updateReviewVisibility(db, reviewId, userId, visible) {
  const { data: review, error } = await db
    .from('reviews')
    .select('*')
    .eq('id', reviewId)
    .single()

  if (error) throw error

  const artistId = await getArtistIdForProfile(db, userId)
  if (!artistId || review.reviewee_artist_id !== artistId) {
    throw new Error('Forbidden')
  }

  const { data, error: updateError } = await db
    .from('reviews')
    .update({ visible_on_profile: !!visible })
    .eq('id', reviewId)
    .select()
    .single()

  if (updateError) throw updateError
  return mapReviewToClient(data)
}

export async function updateArtistReviewSettings(db, userId, { showReviewsOnProfile }) {
  const artistId = await getArtistIdForProfile(db, userId)
  if (!artistId) throw new Error('Not an artist')

  const { error } = await db
    .from('artists')
    .update({ show_reviews_on_profile: !!showReviewsOnProfile })
    .eq('id', artistId)

  if (error) throw error
  return { showReviewsOnProfile: !!showReviewsOnProfile }
}

export async function getArtistReviewSettings(db, artistId) {
  const { data, error } = await db
    .from('artists')
    .select('show_reviews_on_profile')
    .eq('id', artistId)
    .maybeSingle()

  if (error) throw error
  return { showReviewsOnProfile: data?.show_reviews_on_profile !== false }
}
