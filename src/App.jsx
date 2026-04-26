import { useState, useCallback, lazy, Suspense, useMemo, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LayoutDashboard, Trophy, MessageSquare, Calendar, FileText, CreditCard, LogOut, Loader2, User, Menu, X } from './components/icons'
import { isArtistProfile, demoArtistPersona } from './lib/roleView'
import { AppContext } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { useFavorites } from './hooks/useData'
import { messages as mockMessages, contracts as mockContracts } from './data/mockData'
import NotificationPanel from './components/NotificationPanel'
import ErrorBoundary from './components/ErrorBoundary'
import BrandLogo from './components/BrandLogo'

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
const Account = lazy(() => import('./pages/Account'))
const NotFound = lazy(() => import('./pages/NotFound'))

function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <Loader2 size={32} className="animate-spin" aria-hidden />
      <span className="loading-screen__label">Loading…</span>
      <span className="sr-only">Please wait while the page loads.</span>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="page-container loading-screen" style={{ paddingTop: 80 }} role="status" aria-live="polite">
        <Loader2 size={32} className="animate-spin" aria-hidden />
        <span className="loading-screen__label">Checking your session…</span>
        <span className="sr-only">Authentication in progress.</span>
      </div>
    )
  }
  return isAuthenticated ? children : <Navigate to="/signin" />
}

function HomeGate() {
  const { profile } = useAuth()
  if (isArtistProfile(profile)) return <Navigate to="/dashboard" replace />
  return <Leaderboard />
}

function formatAccountRole(role) {
  if (!role) return 'Hirer'
  const map = { employer: 'Hirer', artist: 'Artist', admin: 'Admin' }
  return map[role] || role.charAt(0).toUpperCase() + role.slice(1)
}

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, signOut, isMockMode } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { favorites, toggleFavorite } = useFavorites(user?.id)
  const [allMessages, setAllMessages] = useState(mockMessages)
  const [localContracts, setLocalContracts] = useState(mockContracts)

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
    localContracts,
    setLocalContracts,
  }

  const handleSignOut = async () => {
    console.log('[App] handleSignOut initiated')
    try {
      await signOut()
      console.log('[App] signOut success')
    } catch (e) {
      console.error('[App] signOut error:', e)
    } finally {
      setMobileNavOpen(false)
      console.log('[App] navigating to /signin')
      navigate('/signin', { replace: true })
    }
  }

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (mobileNavOpen) document.body.classList.add('nav-drawer-open')
    else document.body.classList.remove('nav-drawer-open')
    return () => document.body.classList.remove('nav-drawer-open')
  }, [mobileNavOpen])

  const goNav = (path) => {
    navigate(path)
    setMobileNavOpen(false)
  }

  const homePath = isArtistProfile(profile) ? '/dashboard' : '/'

  return (
    <AppContext.Provider value={ctx}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="app-layout">
        <header className="mobile-topbar">
          <button
            type="button"
            className="mobile-topbar-brand mobile-topbar-brand--home"
            onClick={() => goNav(homePath)}
            aria-label="Second Unit — go to home"
          >
            <BrandLogo variant="compact" />
          </button>
          <button
            type="button"
            className="mobile-menu-btn"
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar"
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
            <span className="sr-only">{mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}</span>
          </button>
        </header>

        <button
          type="button"
          className={`mobile-nav-overlay${mobileNavOpen ? ' is-open' : ''}`}
          aria-label="Close menu"
          tabIndex={mobileNavOpen ? 0 : -1}
          onClick={() => setMobileNavOpen(false)}
        />

        <aside id="app-sidebar" className={`sidebar${mobileNavOpen ? ' sidebar--open' : ''}`}>
          <button
            type="button"
            className="logo logo--home"
            onClick={() => goNav(homePath)}
            aria-label="Second Unit — AI artist platform, go to home"
          >
            <BrandLogo />
            <span className="sr-only">Second Unit — AI artist platform</span>
          </button>
          <nav>
            <div className="nav-section">
              <div className="nav-label">Main</div>
              {navItems.map((item) => {
                const active = item.matchPrefix
                  ? location.pathname === item.matchPrefix || location.pathname.startsWith(`${item.matchPrefix}/`)
                  : location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`nav-link ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => goNav(item.path)}
                  >
                    <item.icon size={18} aria-hidden />
                    {item.label}
                    {item.badge && <span className="badge">{item.badge}</span>}
                  </button>
                )
              })}
            </div>
            <div className="nav-section" style={{ marginTop: 'auto' }}>
              <div className="nav-label">Account</div>
              <div 
                className="nav-link" 
                onClick={() => goNav('/account')}
                style={{ 
                  padding: '8px 12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 10, 
                  marginBottom: 8,
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div className="avatar avatar-sm">
                  {(profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile?.full_name || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatAccountRole(profile?.role)}{isMockMode ? ' · demo' : ''}
                  </div>
                </div>
                <NotificationPanel />
              </div>
              <button 
                type="button" 
                className="nav-link sign-out-btn" 
                onClick={handleSignOut}
                style={{ marginTop: 4 }}
              >
                <LogOut size={18} aria-hidden /> Sign Out
              </button>
            </div>
          </nav>
        </aside>
        <main id="main-content" className="main-content" tabIndex={-1}>
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
                <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
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
