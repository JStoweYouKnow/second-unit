import { useCallback, useMemo, useState, useEffect } from 'react'
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

export function useArtistReviews(artistId, mockArtist) {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    bump()
  }, [artistId, mockArtist, bump])

  const settings = useMemo(
    () => getArtistReviewSettings(artistId),
    [artistId, version]
  )

  const allReviews = useMemo(
    () => getAllReviewsForArtist(artistId, mockArtist),
    [artistId, mockArtist, version]
  )

  const publicReviews = useMemo(
    () => getPublicReviewsForArtist(artistId, mockArtist),
    [artistId, mockArtist, version]
  )

  const publicAverage = useMemo(() => getAverageRating(publicReviews), [publicReviews])
  const allAverage = useMemo(() => getAverageRating(allReviews), [allReviews])

  const updateShowOnProfile = useCallback(
    (showReviewsOnProfile) => {
      setArtistReviewSettings(artistId, { showReviewsOnProfile })
      bump()
    },
    [artistId, bump]
  )

  const updateReviewVisibility = useCallback(
    (reviewId, visible) => {
      setReviewVisibleOnProfile(artistId, reviewId, visible)
      bump()
    },
    [artistId, bump]
  )

  const submitReview = useCallback(
    (payload) => {
      const review = submitHirerReview({ artistId, ...payload })
      bump()
      return review
    },
    [artistId, bump]
  )

  const getVisibility = useCallback(
    (reviewId) => isReviewVisibleOnProfile(artistId, reviewId),
    [artistId, version]
  )

  const hirerExistingReview = useCallback(
    (hirerId) => findHirerReview(artistId, hirerId),
    [artistId, version]
  )

  return {
    settings,
    allReviews,
    publicReviews,
    publicAverage,
    allAverage,
    updateShowOnProfile,
    updateReviewVisibility,
    submitReview,
    getVisibility,
    hirerExistingReview,
    refresh: bump,
  }
}
