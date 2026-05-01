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
          await fetchProfile(session.user.id, session.user)
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

  async function fetchProfile(userId, sessionUser = null) {
    try {
      let { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        
      // Self-heal: If the DB trigger used an old default of 'employer', but they signed up as 'artist'
      const targetUser = sessionUser || user
      if (data?.role === 'employer' && targetUser?.user_metadata?.role === 'artist') {
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'artist' })
          .eq('id', userId)
          .select()
          .single()
          
        if (!updateError && updatedProfile) {
          data = updatedProfile
        }
      }
      
      setProfile(data)
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
      const savedRole = localStorage.getItem('mock_user_role') || 'employer'
      const savedName = localStorage.getItem('mock_user_name') || MOCK_USER.user_metadata.full_name
      const savedEmail = localStorage.getItem('mock_user_email') || MOCK_USER.email

      setUser({ ...MOCK_USER, email: savedEmail, user_metadata: { full_name: savedName, role: savedRole } })
      setProfile({ ...MOCK_PROFILE, email: savedEmail, full_name: savedName, role: savedRole })
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
