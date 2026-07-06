import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, clearPersistedAuthSession } from '../lib/supabase'
import { getAuthRedirectBaseUrl } from '../lib/siteUrl'
import { getPasswordResetRedirectUrl } from '../lib/authRecovery'
import { flushPendingArtistApplication } from '../hooks/useArtistApplication'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

// Mock user for development without Supabase
const MOCK_USER = {
  id: 'mock-user-001',
  email: 'demo@thecallsheet.ai',
  user_metadata: { full_name: 'Demo User', role: 'employer' },
}

const MOCK_PROFILE = {
  id: 'mock-user-001',
  email: 'demo@thecallsheet.ai',
  full_name: 'Demo User',
  role: 'employer',
  avatar_url: null,
}

const AUTH_REQUEST_TIMEOUT_MS = 15000
const PROFILE_FETCH_TIMEOUT_MS = 10000

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adminViewAs, setAdminViewAsState] = useState(null) // null | 'employer' | 'artist'

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Mock mode — auto-login as demo user, remembering any mock signup choices
      const savedRole = localStorage.getItem('mock_user_role') || 'employer'
      const savedName = localStorage.getItem('mock_user_name') || MOCK_USER.user_metadata.full_name
      const savedEmail = localStorage.getItem('mock_user_email') || MOCK_USER.email

      setUser({ ...MOCK_USER, email: savedEmail, user_metadata: { full_name: savedName, role: savedRole } })
      setProfile({ ...MOCK_PROFILE, email: savedEmail, full_name: savedName, role: savedRole })
      setLoading(false)
      return
    }

    // Fallback: if auth takes too long (e.g. unreachable API during token refresh), force load
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 5000)

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          scheduleProfileFetch(session.user.id, session.user)
        }
      })
      .catch((err) => {
        console.error('Supabase getSession failed', err)
        setUser(null)
      })
      .finally(() => {
        clearTimeout(timeoutId)
        setLoading(false)
      })

    // Never await Supabase DB calls inside onAuthStateChange — it can deadlock sign-in.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        scheduleProfileFetch(session.user.id, session.user)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  function scheduleProfileFetch(userId, sessionUser = null) {
    setTimeout(() => {
      void fetchProfile(userId, sessionUser)
    }, 0)
  }

  async function fetchProfile(userId, sessionUser = null) {
    if (!isSupabaseConfigured) {
      const savedRole = localStorage.getItem('mock_user_role') || 'employer'
      const savedName = localStorage.getItem('mock_user_name') || MOCK_USER.user_metadata.full_name
      const savedEmail = localStorage.getItem('mock_user_email') || MOCK_USER.email
      setProfile({ ...MOCK_PROFILE, id: userId || MOCK_USER.id, email: savedEmail, full_name: savedName, role: savedRole })
      return
    }

    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        PROFILE_FETCH_TIMEOUT_MS,
        'Loading profile timed out'
      )

      if (error) {
        console.error('fetchProfile error:', error.message, error.code)
        setProfile(null)
        return
      }

      if (!data) {
        setProfile(null)
        return
      }

      let profileData = data

      // Self-heal: metadata says artist but profile still employer (never override admin).
      const targetUser = sessionUser || user
      if (
        profileData?.role === 'employer' &&
        targetUser?.user_metadata?.role === 'artist'
      ) {
        const { data: updatedProfile, error: updateError } = await withTimeout(
          supabase.from('profiles').update({ role: 'artist' }).eq('id', userId).select().maybeSingle(),
          PROFILE_FETCH_TIMEOUT_MS,
          'Profile update timed out'
        )

        if (!updateError && updatedProfile) {
          profileData = updatedProfile
        }
      }

      setProfile(profileData)

      void flushPendingArtistApplication({
        profileId: profileData.id,
        email: targetUser?.email || profileData.email,
      }).then(({ error: flushError }) => {
        if (flushError) {
          console.warn('[auth] Pending artist application could not be submitted:', flushError.message)
        }
      })
    } catch (err) {
      console.error('fetchProfile failed', err)
      setProfile(null)
    }
  }

  async function signUp({ email, password, fullName, role = 'employer' }) {
    if (!isSupabaseConfigured) {
      localStorage.setItem('mock_user_role', role)
      localStorage.setItem('mock_user_name', fullName)
      localStorage.setItem('mock_user_email', email)
      
      const newUser = { ...MOCK_USER, email, user_metadata: { full_name: fullName, role } }
      const newProfile = { ...MOCK_PROFILE, email, full_name: fullName, role }
      
      setUser(newUser)
      setProfile(newProfile)
      return { data: { user: newUser }, error: null }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
          emailRedirectTo: getAuthRedirectUrl(),
        },
      })
      if (error?.message?.toLowerCase().includes('database error')) {
        console.warn(
          '[auth] Profile insert likely failed in Postgres. Run supabase/fix-database-error-new-user.sql in the Supabase SQL Editor, then check Logs → Postgres for the exact error.'
        )
      }
      return { data, error }
    } catch (err) {
      console.error('[auth] signUp error:', err)
      return { data: null, error: { message: err.message || 'An unexpected error occurred during sign up.' } }
    }
  }

  async function signIn({ email, password }) {
    if (!isSupabaseConfigured) {
      const savedRole = localStorage.getItem('mock_user_role') || 'employer'
      const savedName = localStorage.getItem('mock_user_name') || MOCK_USER.user_metadata.full_name
      const savedEmail = localStorage.getItem('mock_user_email') || MOCK_USER.email

      setUser({ ...MOCK_USER, email: savedEmail, user_metadata: { full_name: savedName, role: savedRole } })
      setProfile({ ...MOCK_PROFILE, email: savedEmail, full_name: savedName, role: savedRole })
      return { data: { user: MOCK_USER }, error: null }
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_REQUEST_TIMEOUT_MS,
        'Sign in timed out. Check your connection and try again.'
      )
      if (!error && data?.user) {
        scheduleProfileFetch(data.user.id, data.user)
      }
      return { data, error }
    } catch (err) {
      console.error('[auth] signIn error:', err)
      return { data: null, error: { message: err.message || 'An unexpected error occurred during sign in.' } }
    }
  }

  async function signOut() {
    // Clear React state immediately so the UI responds even if the network call is slow.
    setUser(null)
    setProfile(null)

    if (!isSupabaseConfigured) {
      return { error: null }
    }

    try {
      const localSignOut = supabase.auth.signOut({ scope: 'local' })
      await Promise.race([
        localSignOut,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('signOut timed out')), 4000)
        }),
      ])
    } catch (err) {
      console.error('[auth] signOut local failed — clearing persisted session', err)
      clearPersistedAuthSession()
    }

    // Revoke refresh token server-side; don't block the UI on this.
    void supabase.auth.signOut({ scope: 'global' }).catch((err) => {
      console.warn('[auth] signOut global (non-blocking)', err)
    })

    return { error: null }
  }

  function getAuthRedirectUrl() {
    return `${getAuthRedirectBaseUrl()}/`
  }

  /**
   * @param {'google' | 'github' | 'linkedin_oidc'} provider Supabase Auth provider id
   */
  async function signInWithOAuth(provider) {
    if (!isSupabaseConfigured) {
      setUser(MOCK_USER)
      setProfile(MOCK_PROFILE)
      return { error: null }
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    })
    return { data, error }
  }

  async function resetPassword(email) {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Password reset is unavailable in demo mode.' } }
    }
    return await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectUrl(),
    })
  }

  async function updatePassword(newPassword) {
    if (!isSupabaseConfigured) return { error: null }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { error: { message: 'Your reset session expired. Request a new password reset link.' } }
    }

    return await supabase.auth.updateUser({ password: newPassword })
  }

  const isAdmin = profile?.role === 'admin'
  const effectiveRole = isAdmin && adminViewAs ? adminViewAs : profile?.role

  function setAdminViewAs(role) {
    if (isAdmin) setAdminViewAsState(role)
  }

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    isMockMode: !isSupabaseConfigured,
    adminViewAs,
    setAdminViewAs,
    effectiveRole,
    signUp,
    signIn,
    signOut,
    signInWithOAuth,
    resetPassword,
    updatePassword,
    fetchProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
