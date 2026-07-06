import { useCallback, useMemo, useState, useEffect } from 'react'
import { reviews as reviewsApi } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  getAllReviewsForArtist,
  getPublicReviewsForArtist,
  getArtistReviewSettings,
  setArtistReviewSettings,
  setReviewVisibleOnProfile,
  isReviewVisibleOnProfile,
  getAverageRating,
  submitHirerReview,
  findHirerReview,
} from '../lib/reviewsStore'

function getAverage(reviews) {
  if (!reviews?.length) return null
  const sum = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

export function useArtistReviews(artistId) {
  const [version, setVersion] = useState(0)
  const [remote, setRemote] = useState({ reviews: [], settings: { showReviewsOnProfile: true } })
  const [loading, setLoading] = useState(false)

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const fetchRemote = useCallback(async () => {
    if (!artistId || !isSupabaseConfigured) return
    setLoading(true)
    try {
      const data = await reviewsApi.list(artistId)
      setRemote({
        reviews: data.reviews || [],
        settings: data.settings || { showReviewsOnProfile: true },
      })
    } catch {
      setRemote({ reviews: [], settings: { showReviewsOnProfile: true } })
    } finally {
      setLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    fetchRemote()
  }, [fetchRemote, version])

  const settings = useMemo(() => {
    if (isSupabaseConfigured) return remote.settings
    return getArtistReviewSettings(artistId)
  }, [artistId, version, remote.settings])

  const allReviews = useMemo(() => {
    if (isSupabaseConfigured) return remote.reviews
    return getAllReviewsForArtist(artistId)
  }, [artistId, version, remote.reviews])

  const publicReviews = useMemo(() => {
    if (isSupabaseConfigured) {
      if (!settings.showReviewsOnProfile) return []
      return allReviews.filter((r) => r.visibleOnProfile !== false)
    }
    return getPublicReviewsForArtist(artistId)
  }, [allReviews, settings.showReviewsOnProfile, artistId])

  const publicAverage = useMemo(() => getAverage(publicReviews), [publicReviews])
  const allAverage = useMemo(() => getAverage(allReviews), [allReviews])

  const updateShowOnProfile = useCallback(
    async (showReviewsOnProfile) => {
      if (isSupabaseConfigured) {
        await reviewsApi.updateSettings({ showReviewsOnProfile })
        bump()
        return
      }
      setArtistReviewSettings(artistId, { showReviewsOnProfile })
      bump()
    },
    [artistId, bump]
  )

  const updateReviewVisibility = useCallback(
    async (reviewId, visible) => {
      if (isSupabaseConfigured) {
        await reviewsApi.setVisibility(reviewId, visible)
        bump()
        return
      }
      setReviewVisibleOnProfile(artistId, reviewId, visible)
      bump()
    },
    [artistId, bump]
  )

  const submitReview = useCallback(
    async (payload) => {
      if (isSupabaseConfigured) {
        const review = await reviewsApi.submit({ artistId, ...payload })
        bump()
        return review
      }
      const review = submitHirerReview({ artistId, ...payload })
      bump()
      return review
    },
    [artistId, bump]
  )

  const getVisibility = useCallback(
    (reviewId) => {
      if (isSupabaseConfigured) {
        const r = allReviews.find((rev) => rev.id === reviewId)
        return r?.visibleOnProfile !== false
      }
      return isReviewVisibleOnProfile(artistId, reviewId)
    },
    [artistId, allReviews]
  )

  const hirerExistingReview = useCallback(
    (hirerId) => {
      if (isSupabaseConfigured) {
        return allReviews.find((r) => r.hirerId === hirerId) || null
      }
      return findHirerReview(artistId, hirerId)
    },
    [artistId, allReviews]
  )

  return {
    settings,
    allReviews,
    publicReviews,
    publicAverage,
    allAverage,
    loading,
    updateShowOnProfile,
    updateReviewVisibility,
    submitReview,
    getVisibility,
    hirerExistingReview,
    refresh: bump,
  }
}
