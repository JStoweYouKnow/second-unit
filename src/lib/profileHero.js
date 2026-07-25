import { videoReelUrl, videoReelUrls } from './videoReels.js'

/**
 * Resolve profile header media from featured picks, with auto fallback.
 * @returns {{ heroVideo: string|null, heroImg: string|null, source: 'portfolio'|'video_link'|'auto'|null }}
 */
export function resolveProfileHero({
  portfolioItems = [],
  videoLinks = [],
  featuredPortfolioItemId = null,
  featuredVideoLink = null,
  getVideoThumb = () => null,
} = {}) {
  const featuredItem = featuredPortfolioItemId
    ? portfolioItems.find((p) => p.id === featuredPortfolioItemId)
    : null

  if (featuredItem?.video) {
    return { heroVideo: featuredItem.video, heroImg: null, source: 'portfolio' }
  }
  if (featuredItem?.image) {
    return { heroVideo: null, heroImg: featuredItem.image, source: 'portfolio' }
  }

  if (featuredVideoLink) {
    const thumb = getVideoThumb(featuredVideoLink)
    if (thumb) {
      return { heroVideo: null, heroImg: thumb, source: 'video_link' }
    }
  }

  const first = portfolioItems[0]
  if (first?.video) {
    return { heroVideo: first.video, heroImg: null, source: 'auto' }
  }
  if (first?.image) {
    return { heroVideo: null, heroImg: first.image, source: 'auto' }
  }

  const firstReelUrl = videoReelUrls(videoLinks)[0] || videoReelUrl(videoLinks[0])
  const linkThumb = getVideoThumb(firstReelUrl)
  if (linkThumb) {
    return { heroVideo: null, heroImg: linkThumb, source: 'auto' }
  }

  return { heroVideo: null, heroImg: null, source: null }
}
