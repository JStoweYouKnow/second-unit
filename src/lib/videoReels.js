/**
 * Video reels: { url, title, thumbnail? }[].
 * Legacy storage was a string[] of URLs (or comma-separated string).
 */

export function emptyVideoReelRow() {
  return { url: '', title: '', thumbnail: '' }
}

function trimStr(value) {
  return String(value || '').trim()
}

/** Normalize DB / form / legacy values into { url, title, thumbnail }[]. */
export function normalizeVideoReels(value) {
  if (!value) return []

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url, title: '', thumbnail: '' }))
  }

  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const url = item.trim()
        return url ? { url, title: '', thumbnail: '' } : null
      }
      if (item && typeof item === 'object') {
        const url = trimStr(item.url || item.href)
        if (!url) return null
        return {
          url,
          title: trimStr(item.title || item.name),
          thumbnail: trimStr(item.thumbnail || item.poster || item.thumb),
        }
      }
      return null
    })
    .filter(Boolean)
}

/** Form rows — always at least one empty row. Keeps blank rows (unlike normalizeVideoReels). */
export function videoReelsToFormRows(value) {
  if (!value) return [emptyVideoReelRow()]

  if (typeof value === 'string') {
    const urls = value.split(',').map((s) => s.trim()).filter(Boolean)
    return urls.length
      ? urls.map((url) => ({ url, title: '', thumbnail: '' }))
      : [emptyVideoReelRow()]
  }

  if (!Array.isArray(value)) return [emptyVideoReelRow()]

  const rows = value
    .map((item) => {
      if (typeof item === 'string') {
        return { url: item.trim(), title: '', thumbnail: '' }
      }
      if (item && typeof item === 'object') {
        return {
          url: trimStr(item.url || item.href),
          title: trimStr(item.title || item.name),
          thumbnail: trimStr(item.thumbnail || item.poster || item.thumb),
        }
      }
      return null
    })
    .filter(Boolean)

  return rows.length ? rows : [emptyVideoReelRow()]
}

/** Payload for DB: jsonb video_reels + legacy text[] video_links. */
export function videoReelsToPayload(value) {
  const reels = normalizeVideoReels(value)
    .filter((r) => r.url)
    .map((r) => {
      const row = { url: r.url, title: r.title || '' }
      if (r.thumbnail) row.thumbnail = r.thumbnail
      return row
    })
  return {
    video_reels: reels,
    video_links: reels.map((r) => r.url),
  }
}

export function videoReelUrl(item) {
  if (!item) return ''
  if (typeof item === 'string') return item.trim()
  return trimStr(item.url)
}

export function videoReelThumbnail(item) {
  if (!item || typeof item === 'string') return ''
  return trimStr(item.thumbnail || item.poster || item.thumb)
}

export function videoReelTitle(item, index = 0) {
  if (item && typeof item === 'object' && trimStr(item.title)) {
    return trimStr(item.title)
  }
  return `Video Reel ${index + 1}`
}

export function videoReelUrls(value) {
  return normalizeVideoReels(value).map((r) => r.url)
}

/** Extract YouTube video id from common URL shapes. */
export function parseYouTubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id || null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        return parts[1] || null
      }
    }
  } catch {
    // fall through
  }
  return null
}

/** Extract Vimeo video id from common URL shapes. */
export function parseVimeoId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] === 'video') return parts[1] || null
    return parts.find((p) => /^\d+$/.test(p)) || null
  } catch {
    return null
  }
}

/**
 * Embed URL for iframe players.
 * @param {string} url
 * @param {{ autoplay?: boolean }} [opts]
 */
export function getVideoEmbedUrl(url, opts = {}) {
  const { autoplay = false } = opts
  const yt = parseYouTubeId(url)
  if (yt) {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
    })
    if (autoplay) params.set('autoplay', '1')
    return `https://www.youtube.com/embed/${yt}?${params.toString()}`
  }

  const vimeo = parseVimeoId(url)
  if (vimeo) {
    const params = new URLSearchParams({
      title: '0',
      byline: '0',
      portrait: '0',
    })
    if (autoplay) params.set('autoplay', '1')
    return `https://player.vimeo.com/video/${vimeo}?${params.toString()}`
  }

  return null
}

/** Platform default poster when no custom thumbnail is set. */
export function getDefaultVideoPoster(url) {
  const yt = parseYouTubeId(url)
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`

  const vimeo = parseVimeoId(url)
  if (vimeo) return `https://vumbnail.com/${vimeo}.jpg`

  return null
}

/** Custom thumbnail wins; otherwise platform default. */
export function resolveVideoPoster(url, thumbnail) {
  const custom = trimStr(thumbnail)
  if (custom) return custom
  return getDefaultVideoPoster(url)
}
