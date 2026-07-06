import { supabase, isSupabaseConfigured } from './supabase'
import { getInviteBaseUrl } from './siteUrl'

function cleanRecoveryParamsFromUrl() {
  const url = new URL(window.location.href)
  let changed = false

  if (url.searchParams.has('code')) {
    url.searchParams.delete('code')
    changed = true
  }

  const hash = url.hash.replace(/^#/, '')
  if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
    url.hash = ''
    changed = true
  }

  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }
}

/**
 * Establishes a Supabase recovery session from the email link (PKCE code or hash tokens).
 */
export async function establishRecoverySession() {
  if (!isSupabaseConfigured || !supabase) {
    return { ready: false, error: 'Password reset is unavailable in demo mode.' }
  }

  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return { ready: false, error: error.message || 'Invalid or expired reset link.' }
    }
    cleanRecoveryParamsFromUrl()
    return { ready: true, error: null }
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const isRecoveryHash =
    hashParams.get('type') === 'recovery' && Boolean(hashParams.get('access_token'))

  if (isRecoveryHash) {
    // detectSessionInUrl processes the hash on client init; give it a moment.
    await new Promise((r) => setTimeout(r, 0))
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) return { ready: false, error: error.message }
    if (session) {
      cleanRecoveryParamsFromUrl()
      return { ready: true, error: null }
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    cleanRecoveryParamsFromUrl()
    return { ready: true, error: null }
  }

  return waitForRecoverySessionEvent()
}

function waitForRecoverySessionEvent(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      subscription.unsubscribe()
      clearTimeout(timer)
      resolve(result)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        cleanRecoveryParamsFromUrl()
        finish({ ready: true, error: null })
      }
    })

    const timer = setTimeout(() => {
      finish({
        ready: false,
        error: 'This reset link is invalid or has expired. Request a new link from the sign-in page.',
      })
    }, timeoutMs)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish({ ready: true, error: null })
    })
  })
}

/** Redirect target embedded in password-reset emails — always production. */
export function getPasswordResetRedirectUrl() {
  return `${getInviteBaseUrl()}/update-password`
}
