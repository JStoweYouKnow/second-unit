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

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
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
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
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
    await supabase.auth.signOut()
  }

  async function signInWithOAuth(provider) {
    if (!isSupabaseConfigured) {
      setUser(MOCK_USER)
      setProfile(MOCK_PROFILE)
      return
    }
    await supabase.auth.signInWithOAuth({ provider })
  }

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isMockMode: !isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    signInWithOAuth,
    fetchProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
