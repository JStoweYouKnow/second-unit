import * as Sentry from '@sentry/react'

let initialized = false

export function initClientSentry() {
  if (initialized) return
  initialized = true

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
  })
}

export function captureClientException(error, context = {}) {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.error(error, context)
    return
  }
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v))
    Sentry.captureException(error)
  })
}

export { Sentry }
