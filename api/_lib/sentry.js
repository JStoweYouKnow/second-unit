/**
 * Optional Sentry for Node/serverless. No-ops when SENTRY_DSN is unset.
 */

let Sentry = null
let initialized = false

export async function initSentry() {
  if (initialized) return Sentry
  initialized = true

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return null

  try {
    const mod = await import('@sentry/node')
    Sentry = mod
    Sentry.init({
      dsn,
      environment:
        process.env.SENTRY_ENVIRONMENT ||
        process.env.VERCEL_ENV ||
        process.env.NODE_ENV ||
        'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    })
    return Sentry
  } catch (err) {
    console.warn('[sentry] @sentry/node not available:', err.message)
    Sentry = null
    return null
  }
}

export function captureException(err, context = {}) {
  if (!Sentry) {
    console.error('[error]', err?.message || err, context)
    return
  }
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v))
    Sentry.captureException(err)
  })
}

export function captureMessage(message, level = 'info', context = {}) {
  if (!Sentry) {
    console.log(`[${level}]`, message, context)
    return
  }
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v))
    Sentry.captureMessage(message, level)
  })
}
