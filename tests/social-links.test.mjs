import assert from 'node:assert/strict'
import { normalizeSocialUrl } from '../src/lib/socialLinks.js'

assert.equal(
  normalizeSocialUrl('@verena', 'instagram'),
  'https://www.instagram.com/verena/'
)
assert.equal(
  normalizeSocialUrl('verena', 'instagram'),
  'https://www.instagram.com/verena/'
)
assert.equal(
  normalizeSocialUrl('instagram.com/verena', 'instagram'),
  'https://instagram.com/verena'
)
assert.equal(
  normalizeSocialUrl('https://www.instagram.com/verena/', 'instagram'),
  'https://www.instagram.com/verena/'
)
assert.equal(normalizeSocialUrl('#', 'instagram'), null)
assert.equal(normalizeSocialUrl('', 'instagram'), null)

assert.equal(normalizeSocialUrl('@artist', 'twitter'), 'https://x.com/artist')
assert.equal(
  normalizeSocialUrl('linkedin.com/in/jane', 'linkedin'),
  'https://linkedin.com/in/jane'
)
assert.equal(normalizeSocialUrl('example.com', 'website'), 'https://example.com')

console.log('social-links.test.mjs: ok')
