import assert from 'node:assert/strict'
import { resolveProfileHero } from '../src/lib/profileHero.js'

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

console.log('profile-hero.test.mjs: ok')
