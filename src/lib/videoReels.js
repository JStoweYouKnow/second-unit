/**
 * Video reels: { url, title }[].
 * Legacy storage was a string[] of URLs (or comma-separated string).
 */

export function emptyVideoReelRow() {
  return { url: '', title: '' }
}

/** Normalize DB / form / legacy values into { url, title }[]. */
export function normalizeVideoReels(value) {
  if (!value) return []

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url, title: '' }))
  }

  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const url = item.trim()
        return url ? { url, title: '' } : null
      }
      if (item && typeof item === 'object') {
        const url = String(item.url || item.href || '').trim()
        if (!url) return null
        return {
          url,
          title: String(item.title || item.name || '').trim(),
        }
      }
      return null
    })
    .filter(Boolean)
}

/** Form rows — always at least one empty row. */
export function videoReelsToFormRows(value) {
  const list = normalizeVideoReels(value)
  return list.length ? list.map((r) => ({ url: r.url, title: r.title })) : [emptyVideoReelRow()]
}

/** Payload for DB: jsonb video_reels + legacy text[] video_links. */
export function videoReelsToPayload(value) {
  const reels = normalizeVideoReels(value).filter((r) => r.url)
  return {
    video_reels: reels,
    video_links: reels.map((r) => r.url),
  }
}

export function videoReelUrl(item) {
  if (!item) return ''
  if (typeof item === 'string') return item.trim()
  return String(item.url || '').trim()
}

export function videoReelTitle(item, index = 0) {
  if (item && typeof item === 'object' && String(item.title || '').trim()) {
    return String(item.title).trim()
  }
  return `Video Reel ${index + 1}`
}

export function videoReelUrls(value) {
  return normalizeVideoReels(value).map((r) => r.url)
}
