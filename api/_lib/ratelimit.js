// In-memory sliding window rate limiter.
// Each Vercel Function instance has its own memory, so this limits per-instance
// rather than globally. For global rate limiting, use Vercel's built-in or a Redis store.
const windows = new Map()

/**
 * @param {string} key      - Unique key (e.g. IP address)
 * @param {number} limit    - Max requests allowed in the window
 * @param {number} windowMs - Window size in milliseconds
 * @returns {{ ok: boolean, remaining: number }}
 */
export function rateLimit(key, limit = 20, windowMs = 60_000) {
  const now = Date.now()
  const windowStart = now - windowMs

  let timestamps = windows.get(key) || []
  timestamps = timestamps.filter(t => t > windowStart)
  timestamps.push(now)
  windows.get(key) ? windows.set(key, timestamps) : windows.set(key, timestamps)

  if (windows.size > 10_000) {
    for (const [k, ts] of windows) {
      if (ts[ts.length - 1] < windowStart) windows.delete(k)
    }
  }

  const remaining = Math.max(0, limit - timestamps.length)
  return { ok: timestamps.length <= limit, remaining }
}

export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}
