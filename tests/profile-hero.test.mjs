import assert from 'node:assert/strict'
import { getArtistListTileThumb, resolveProfileHero } from '../src/lib/profileHero.js'

const getVideoThumb = (url) => (url ? `thumb:${url}` : null)

const portfolio = [
  { id: 'a', image: 'img-a.jpg', video: null },
  { id: 'b', image: null, video: 'vid-b.mp4' },
]

assert.deepEqual(
  resolveProfileHero({
    portfolioItems: portfolio,
    videoLinks: ['https://vimeo.com/1'],
    getVideoThumb,
  }),
  { heroVideo: null, heroImg: 'img-a.jpg', source: 'auto' }
)

assert.deepEqual(
  resolveProfileHero({
    portfolioItems: portfolio,
    videoLinks: [],
    featuredPortfolioItemId: 'b',
    getVideoThumb,
  }),
  { heroVideo: 'vid-b.mp4', heroImg: null, source: 'portfolio' }
)

assert.deepEqual(
  resolveProfileHero({
    portfolioItems: portfolio,
    videoLinks: ['https://vimeo.com/9'],
    featuredVideoLink: 'https://vimeo.com/9',
    getVideoThumb,
  }),
  { heroVideo: null, heroImg: 'thumb:https://vimeo.com/9', source: 'video_link' }
)

assert.deepEqual(
  resolveProfileHero({
    portfolioItems: portfolio,
    videoLinks: [],
    headerImageUrl: 'https://cdn.example/header.jpg',
    featuredPortfolioItemId: 'b',
    getVideoThumb,
  }),
  { heroVideo: null, heroImg: 'https://cdn.example/header.jpg', source: 'header' }
)

assert.equal(
  getArtistListTileThumb({
    headerImageUrl: 'https://cdn.example/header.jpg',
    videoLinks: [{ url: 'https://vimeo.com/9', title: 'Reel' }],
    avatarUrl: 'https://cdn.example/avatar.jpg',
  }),
  'https://cdn.example/header.jpg'
)

assert.equal(
  getArtistListTileThumb({
    videoLinks: [{ url: 'https://www.youtube.com/watch?v=abc123', title: 'Reel' }],
    avatarUrl: 'https://cdn.example/avatar.jpg',
  }),
  'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
)

assert.equal(
  getArtistListTileThumb({ avatarUrl: 'https://cdn.example/avatar.jpg' }),
  'https://cdn.example/avatar.jpg'
)

console.log('profile-hero.test.mjs: ok')
