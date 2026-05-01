import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

// Mock user for development without Supabase
const MOCK_USER = {
  id: 'mock-user-001',
  email: 'demo@secondunit.com',
  user_metadata: { full_name: 'Demo User', role: 'employer' },
}

const MOCK_PROFILE = {
  id: 'mock-user-001',
  email: 'demo@secondunit.com',
  full_name: 'Demo User',
  role: 'employer',
  avatar_url: null,
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Mock mode — auto-login as demo user
      setUser(MOCK_USER)
      setProfile(MOCK_PROFILE)
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
        if (session?.user) fetchProfile(session.user.id)
      })
      .catch((err) => {
        console.error('Supabase getSession failed', err)
        setUser(null)
      })
      .finally(() => {
        clearTimeout(timeoutId)
        setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    } catch (err) {
      console.error('fetchProfile failed', err)
      setProfile(null)
    }
  }

  async function signUp({ email, password, fullName, role = 'employer' }) {
    if (!isSupabaseConfigured) {
      setUser({ ...MOCK_USER, email, user_metadata: { full_name: fullName, role } })
      setProfile({ ...MOCK_PROFILE, email, full_name: fullName, role })
      return { data: { user: MOCK_USER }, error: null }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })
    if (error?.message?.toLowerCase().includes('database error')) {
      console.warn(
        '[auth] Profile insert likely failed in Postgres. Run supabase/fix-database-error-new-user.sql in the Supabase SQL Editor, then check Logs → Postgres for the exact error.'
      )
    }
    return { data, error }
  }

  async function signIn({ email, password }) {
    if (!isSupabaseConfigured) {
      setUser(MOCK_USER)
      setProfile(MOCK_PROFILE)
      return { data: { user: MOCK_USER }, error: null }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      setUser(null)
      setProfile(null)
      return
    }
    try {
      const { error } = await supabase.auth.signOut()
      if (error) console.error('[auth] signOut', error)
    } catch (err) {
      console.error('[auth] signOut', err)
    } finally {
      setUser(null)
      setProfile(null)
    }
  }

  function getAuthRedirectUrl() {
    const base = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
    return `${base}/`
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
    if (!isSupabaseConfigured) return { error: null }
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
  }

  async function updatePassword(newPassword) {
    if (!isSupabaseConfigured) return { error: null }
    return await supabase.auth.updateUser({ password: newPassword })
  }

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin',
    isMockMode: !isSupabaseConfigured,
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
