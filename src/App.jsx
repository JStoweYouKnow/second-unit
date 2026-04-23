import { useState, useCallback, lazy, Suspense, useMemo } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, Trophy, MessageSquare, Calendar, FileText, CreditCard, LogOut, Loader2, User } from './components/icons'
import { isArtistProfile, demoArtistPersona } from './lib/roleView'
import { AppContext } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { useFavorites } from './hooks/useData'
import { messages as mockMessages } from './data/mockData'
import NotificationPanel from './components/NotificationPanel'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy loaded pages (Item 6)
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const ArtistProfile = lazy(() => import('./pages/ArtistProfile'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Messages = lazy(() => import('./pages/Messages'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Contracts = lazy(() => import('./pages/Contracts'))
const Payments = lazy(() => import('./pages/Payments'))
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const NotFound = lazy(() => import('./pages/NotFound'))

function LoadingScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      <Loader2 size={32} className="animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="page-container" style={{ textAlign: 'center', paddingTop: 100, color: 'var(--text-muted)' }}>Loading...</div>
  return isAuthenticated ? children : <Navigate to="/signin" />
}

function HomeGate() {
  const { profile } = useAuth()
  if (isArtistProfile(profile)) return <Navigate to="/dashboard" replace />
  return <Leaderboard />
}

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, signOut, isMockMode } = useAuth()
  const { favorites, toggleFavorite } = useFavorites(user?.id)
  const [allMessages, setAllMessages] = useState(mockMessages)
  const [pricingMode, setPricingMode] = useState('hourly')

  const sendMessage = useCallback((conversationId, text, senderOverride) => {
    setAllMessages(prev => prev.map(m => {
      if (m.id === conversationId) {
        return {
          ...m, lastMessage: text, time: 'Just now', unread: senderOverride === 'artist',
          thread: [...m.thread, { id: Date.now(), sender: senderOverride || 'user', text, time: 'Just now' }]
        }
      }
      return m
    }))
  }, [])

  const startConversation = (artist) => {
    const existing = allMessages.find(m => m.artistId === artist.id)
    if (existing) { navigate('/messages'); return existing.id }
    const newConv = {
      id: Date.now(), artistId: artist.id, artistName: artist.name, avatar: artist.avatar,
      unread: false, lastMessage: '', time: 'Now', thread: []
    }
    setAllMessages(prev => [newConv, ...prev])
    navigate('/messages')
    return newConv.id
  }

  const unreadCount = allMessages.filter(m => m.unread).length
  const demoPersona = demoArtistPersona(profile)

  const navItems = useMemo(() => {
    if (isArtistProfile(profile)) {
      const pid = demoPersona?.id ?? 1
      const profilePath = `/artist/${pid}`
      return [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: profilePath, icon: User, label: 'My profile', matchPrefix: profilePath },
        { path: '/messages', icon: MessageSquare, label: 'Messages', badge: unreadCount || null },
        { path: '/bookings', icon: Calendar, label: 'Bookings' },
        { path: '/contracts', icon: FileText, label: 'Contracts' },
        { path: '/payments', icon: CreditCard, label: 'Earnings' },
      ]
    }
    return [
      { path: '/', icon: Trophy, label: 'Artist Spotlight' },
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/messages', icon: MessageSquare, label: 'Messages', badge: unreadCount || null },
      { path: '/bookings', icon: Calendar, label: 'Bookings' },
      { path: '/contracts', icon: FileText, label: 'Contracts' },
      { path: '/payments', icon: CreditCard, label: 'Payments' },
    ]
  }, [profile?.role, profile?.full_name, unreadCount, demoPersona?.id])

  const ctx = {
    favorites,
    toggleFavorite,
    allMessages,
    sendMessage,
    startConversation,
    pricingMode,
    setPricingMode,
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin')
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon">S</div>
            <span className="logo-text">Second Unit</span>
          </div>
          <nav>
            <div className="nav-section">
              <div className="nav-label">Main</div>
              {navItems.map((item) => {
                const active = item.matchPrefix
                  ? location.pathname === item.matchPrefix || location.pathname.startsWith(`${item.matchPrefix}/`)
                  : location.pathname === item.path
                return (
                  <button key={item.path} className={`nav-link ${active ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}>
                    <item.icon size={18} />
                    {item.label}
                    {item.badge && <span className="badge">{item.badge}</span>}
                  </button>
                )
              })}
            </div>
            <div className="nav-section" style={{ marginTop: 'auto' }}>
              <div className="nav-label">Account</div>
              <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div className="avatar avatar-sm">
                  {(profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile?.full_name || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {profile?.role || 'employer'}{isMockMode ? ' · demo' : ''}
                  </div>
                </div>
                <NotificationPanel />
              </div>
              <button className="nav-link" onClick={handleSignOut}><LogOut size={18} /> Sign Out</button>
            </div>
          </nav>
        </aside>
        <main className="main-content">
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<ProtectedRoute><HomeGate /></ProtectedRoute>} />
                <Route path="/artist/:id" element={<ProtectedRoute><ArtistProfile /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
                <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </AppContext.Provider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/*" element={<AppShell />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
