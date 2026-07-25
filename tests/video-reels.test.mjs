import assert from 'node:assert/strict'
import {
  normalizeVideoReels,
  videoReelsToFormRows,
  videoReelTitle,
  videoReelsToPayload,
  parseYouTubeId,
  getVideoEmbedUrl,
  resolveVideoPoster,
} from '../src/lib/videoReels.js'

assert.deepEqual(normalizeVideoReels(['https://vimeo.com/1']), [
  { url: 'https://vimeo.com/1', title: '', thumbnail: '' },
])

assert.deepEqual(
  normalizeVideoReels([{ url: 'https://vimeo.com/2', title: 'Launch Film' }]),
  [{ url: 'https://vimeo.com/2', title: 'Launch Film', thumbnail: '' }]
)

assert.deepEqual(
  normalizeVideoReels([{
    url: 'https://youtu.be/abc123',
    title: 'Cut',
    thumbnail: 'https://cdn.example/cover.jpg',
  }]),
  [{
    url: 'https://youtu.be/abc123',
    title: 'Cut',
    thumbnail: 'https://cdn.example/cover.jpg',
  }]
)

// Form rows keep blank entries so "Add another reel" works
assert.deepEqual(
  videoReelsToFormRows([
    { url: 'https://vimeo.com/1', title: 'A', thumbnail: '' },
    { url: '', title: '', thumbnail: '' },
  ]),
  [
    { url: 'https://vimeo.com/1', title: 'A', thumbnail: '' },
    { url: '', title: '', thumbnail: '' },
  ]
)
assert.deepEqual(videoReelsToFormRows([]), [{ url: '', title: '', thumbnail: '' }])

assert.equal(videoReelTitle({ url: 'https://x', title: 'My Cut' }, 0), 'My Cut')
assert.equal(videoReelTitle({ url: 'https://x', title: '' }, 2), 'Video Reel 3')

const payload = videoReelsToPayload([
  { url: 'https://vimeo.com/1', title: ' A ', thumbnail: ' https://cdn.example/a.jpg ' },
  { url: '', title: 'skip' },
])
assert.deepEqual(payload.video_reels, [{
  url: 'https://vimeo.com/1',
  title: 'A',
  thumbnail: 'https://cdn.example/a.jpg',
}])
assert.deepEqual(payload.video_links, ['https://vimeo.com/1'])

assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
assert.equal(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')

const embed = getVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ', { autoplay: true })
assert.match(embed, /youtube\.com\/embed\/dQw4w9WgXcQ/)
assert.match(embed, /autoplay=1/)
assert.match(embed, /rel=0/)

assert.equal(
  resolveVideoPoster('https://youtu.be/dQw4w9WgXcQ', 'https://cdn.example/custom.jpg'),
  'https://cdn.example/custom.jpg'
)
assert.equal(
  resolveVideoPoster('https://youtu.be/dQw4w9WgXcQ', ''),
  'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
)

console.log('video-reels.test.mjs: ok')
