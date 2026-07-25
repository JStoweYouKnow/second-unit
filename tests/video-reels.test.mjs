import assert from 'node:assert/strict'
import {
  normalizeVideoReels,
  videoReelTitle,
  videoReelsToPayload,
} from '../src/lib/videoReels.js'

assert.deepEqual(normalizeVideoReels(['https://vimeo.com/1']), [
  { url: 'https://vimeo.com/1', title: '' },
])

assert.deepEqual(
  normalizeVideoReels([{ url: 'https://vimeo.com/2', title: 'Launch Film' }]),
  [{ url: 'https://vimeo.com/2', title: 'Launch Film' }]
)

assert.equal(videoReelTitle({ url: 'https://x', title: 'My Cut' }, 0), 'My Cut')
assert.equal(videoReelTitle({ url: 'https://x', title: '' }, 2), 'Video Reel 3')

const payload = videoReelsToPayload([
  { url: 'https://vimeo.com/1', title: ' A ' },
  { url: '', title: 'skip' },
])
assert.deepEqual(payload.video_reels, [{ url: 'https://vimeo.com/1', title: 'A' }])
assert.deepEqual(payload.video_links, ['https://vimeo.com/1'])

console.log('video-reels.test.mjs: ok')
