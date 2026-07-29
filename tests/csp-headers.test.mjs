import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')

function cspValue() {
  const rule = vercelConfig.headers?.find((h) => h.source === '/(.*)')
  return rule?.headers?.find((h) => h.key === 'Content-Security-Policy')?.value ?? ''
}

test('CSP script-src hash matches the inline bootstrap in index.html', () => {
  const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  assert.equal(inline.length, 1, 'expected exactly one inline <script> in index.html')

  const digest = createHash('sha256').update(inline[0]).digest('base64')
  assert.ok(
    cspValue().includes(`'sha256-${digest}'`),
    `index.html inline script changed — update the CSP hash in vercel.json to 'sha256-${digest}'`
  )
})

test('production CSP locks down the high-risk directives', () => {
  const csp = cspValue()
  for (const directive of [
    "default-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ]) {
    assert.ok(csp.includes(directive), `CSP missing ${directive}`)
  }
  assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"), 'script-src must not allow unsafe-inline')
})

test('baseline security headers are configured', () => {
  const rule = vercelConfig.headers?.find((h) => h.source === '/(.*)')
  const keys = (rule?.headers ?? []).map((h) => h.key)
  for (const key of [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
  ]) {
    assert.ok(keys.includes(key), `missing ${key} header`)
  }
})
