const DEFAULT_PRODUCTION_URL = 'https://www.thecallsheet.ai'

function normalizeOrigin(url) {
  return url?.replace(/\/$/, '') || ''
}

function isLocalOrigin(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)
}

/**
 * Base URL for public artist invite links.
 * Always resolves to production — never localhost — so admins can copy
 * links from local dev and send them to artists safely.
 */
export function getInviteBaseUrl() {
  const production = normalizeOrigin(import.meta.env.VITE_PRODUCTION_URL)
  if (production && !isLocalOrigin(production)) return production

  const site = normalizeOrigin(import.meta.env.VITE_SITE_URL)
  if (site && !isLocalOrigin(site)) return site

  return DEFAULT_PRODUCTION_URL
}

function isVercelPreviewOrigin(url) {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(url)
}

/** General app origin for in-app navigation (not auth email/OAuth callbacks). */
export function getSiteUrl() {
  const site = normalizeOrigin(import.meta.env.VITE_SITE_URL)
  if (site) return site
  if (typeof window !== 'undefined') return window.location.origin
  return DEFAULT_PRODUCTION_URL
}

/**
 * Base URL embedded in Supabase auth flows (OAuth, email confirm, magic links).
 * Local dev → localhost; preview/staging hosts → production URL so users never
 * land on ephemeral Vercel deployment URLs after authenticating.
 */
export function getAuthRedirectBaseUrl() {
  if (typeof window !== 'undefined') {
    const origin = normalizeOrigin(window.location.origin)
    if (isLocalOrigin(origin)) {
      const local = normalizeOrigin(import.meta.env.VITE_SITE_URL)
      return local || origin
    }
    if (isVercelPreviewOrigin(origin)) {
      return getInviteBaseUrl()
    }
    if (!isLocalOrigin(origin)) {
      return origin
    }
  }

  const production = normalizeOrigin(import.meta.env.VITE_PRODUCTION_URL)
  if (production && !isLocalOrigin(production)) return production

  const site = normalizeOrigin(import.meta.env.VITE_SITE_URL)
  if (site && !isLocalOrigin(site)) return site

  return DEFAULT_PRODUCTION_URL
}
