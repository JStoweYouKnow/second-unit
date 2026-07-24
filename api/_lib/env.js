/**
 * Environment helpers for production hardening.
 * Mock payment shortcuts only when explicitly opted in (never on Vercel production).
 */

export function isVercelProduction() {
  return process.env.VERCEL_ENV === 'production'
}

export function isNodeProduction() {
  return process.env.NODE_ENV === 'production'
}

/** True for Vercel production or NODE_ENV=production without an explicit local override. */
export function isProductionRuntime() {
  if (isVercelProduction()) return true
  if (process.env.ALLOW_MOCK_PAYMENTS === 'true') return false
  return isNodeProduction()
}

/**
 * Local/demo only. Never allow on Vercel production even if env is mis-set.
 */
export function allowMockPayments() {
  if (isVercelProduction()) return false
  return process.env.ALLOW_MOCK_PAYMENTS === 'true'
}

export function stripeKeyMode(secretKey = process.env.STRIPE_SECRET_KEY) {
  if (!secretKey) return 'unset'
  if (secretKey.startsWith('sk_live') || secretKey.startsWith('rk_live')) return 'live'
  if (secretKey.startsWith('sk_test') || secretKey.startsWith('rk_test')) return 'test'
  return 'unknown'
}

export function requireServiceRoleInProduction() {
  return isProductionRuntime()
}
