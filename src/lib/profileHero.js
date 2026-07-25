import {
  getDefaultVideoPoster,
  resolveVideoPoster,
  videoReelThumbnail,
  videoReelUrl,
  videoReelUrls,
} from './videoReels.js'

/**
 * Resolve profile header media.
 * Priority: dedicated header image → featured portfolio/reel → auto first media.
 */
export function resolveProfileHero({
  portfolioItems = [],
  videoLinks = [],
  headerImageUrl = null,
  featuredPortfolioItemId = null,
  featuredVideoLink = null,
  getVideoThumb = () => null,
} = {}) {
  if (headerImageUrl) {
    return { heroVideo: null, heroImg: headerImageUrl, source: 'header' }
  }

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

/** Static thumbnail for artist database tiles. Priority: header image → reel poster → avatar. */
export function getArtistListTileThumb(artist) {
  if (artist?.headerImageUrl) return artist.headerImageUrl

  const firstReel = videoReelUrl(artist?.videoLinks?.[0])
  if (firstReel) {
    return (
      resolveVideoPoster(firstReel, videoReelThumbnail(artist?.videoLinks?.[0]))
      || getDefaultVideoPoster(firstReel)
    )
  }

  return artist?.avatarUrl || null
}
