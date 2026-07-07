/**
 * Resolve the API base URL for fetch and Socket.io clients.
 *
 * Production (Vercel): leave VITE_API_URL unset so requests use same-origin /api/* routes.
 * Local dev: set VITE_API_URL=http://localhost:3001 or rely on the Vite proxy with ''.
 */
export function resolveApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '')
  if (!raw) return ''

  let url = raw
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
    url = `https://${url}`
  }

  // Legacy Railway host — API now runs on Vercel serverless at the app origin.
  if (import.meta.env.PROD && /railway\.app/i.test(url)) {
    return ''
  }

  return url
}

export function resolveSocketBaseUrl() {
  const api = resolveApiBaseUrl()
  if (api) return api
  if (import.meta.env.DEV) return 'http://localhost:3001'
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3001'
}

export function resolveApiOrigin() {
  const base = resolveApiBaseUrl()
  if (base) return base
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
