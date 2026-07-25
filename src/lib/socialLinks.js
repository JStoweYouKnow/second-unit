/**
 * Normalize artist social / website fields into absolute https URLs.
 * Accepts full URLs, domain paths, or bare @handles / usernames.
 */

function clean(value) {
  if (value == null) return ''
  return String(value).trim()
}

function stripAt(value) {
  return value.replace(/^@+/, '')
}

function withHttps(url) {
  const t = clean(url)
  if (!t || t === '#') return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('//')) return `https:${t}`
  return `https://${t.replace(/^\/+/, '')}`
}

/** Extract profile username from a platform URL or bare handle. */
function extractUsername(value, hostPattern) {
  const t = stripAt(clean(value)).replace(/\/+$/, '')
  if (!t) return null

  const hostMatch = t.match(hostPattern)
  if (hostMatch) {
    const rest = (hostMatch[1] || '').split(/[?#]/)[0].replace(/^\/+/, '')
    const parts = rest.split('/').filter(Boolean)
    if (!parts.length) return null
    // Skip non-profile path segments (posts, reels, etc.)
    if (['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(parts[0].toLowerCase())) {
      return null
    }
    if (parts[0] === 'in' || parts[0] === 'company') return parts[1] || null
    return parts[0] || null
  }

  // Bare username — no domain-looking dots/slashes
  if (!/[./]/.test(t)) return t
  return null
}

/**
 * @param {string|null|undefined} value
 * @param {'instagram'|'twitter'|'linkedin'|'website'} platform
 * @returns {string|null}
 */
export function normalizeSocialUrl(value, platform) {
  const raw = clean(value)
  if (!raw || raw === '#') return null

  if (platform === 'website') {
    return withHttps(raw)
  }

  if (platform === 'instagram') {
    // Keep full Instagram URLs (profiles, posts, reels) — only add protocol if needed
    if (/instagram\.com|instagr\.am/i.test(raw)) {
      return withHttps(raw)
    }
    const user = extractUsername(raw, /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(.+)$/i)
    if (user) return `https://www.instagram.com/${encodeURIComponent(user)}/`
    // Bare @handle / username
    const handle = stripAt(raw)
    if (handle && !/[./]/.test(handle)) {
      return `https://www.instagram.com/${encodeURIComponent(handle)}/`
    }
    return null
  }

  if (platform === 'twitter') {
    if (/twitter\.com|x\.com/i.test(raw)) {
      return withHttps(raw.replace(/twitter\.com/i, 'x.com'))
    }
    const user = extractUsername(raw, /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(.+)$/i)
    if (user) return `https://x.com/${encodeURIComponent(user)}`
    const handle = stripAt(raw)
    if (handle && !/[./]/.test(handle)) {
      return `https://x.com/${encodeURIComponent(handle)}`
    }
    return null
  }

  if (platform === 'linkedin') {
    if (/linkedin\.com/i.test(raw)) return withHttps(raw)
    const handle = stripAt(raw)
    if (handle && !/[./]/.test(handle)) {
      return `https://www.linkedin.com/in/${encodeURIComponent(handle)}`
    }
    return withHttps(raw)
  }

  return withHttps(raw)
}
