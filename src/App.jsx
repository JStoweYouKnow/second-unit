import { useState, lazy, Suspense, useMemo, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, Trophy, MessageSquare, FileText, CreditCard, LogOut, Loader2, User, Menu, X, UserPlus, Shield, Briefcase } from './components/icons'
import { demoArtistPersona, isArtistProfile } from './lib/roleView'
import { useArtistProfile } from './hooks/useArtistProfile'
import { useMyApplication, isPendingApplicant, useAdminApplications } from './hooks/useArtistApplication'
import { useAdminInvites } from './hooks/useArtistInvites'
import { useDisputes } from './hooks/useDisputes'
import { AppContext } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { useFavorites } from './hooks/useData'
import { useConversations } from './hooks/useConversations'
import { useMessageRealtime } from './hooks/useMessageRealtime'
import { useContracts } from './hooks/useContracts'
import { useBookings } from './hooks/useBookings'
import { adminApi } from './lib/api'
import NotificationPanel from './components/NotificationPanel'
import PushNotificationSync from './components/PushNotificationSync'
import OnboardingGuideModal from './components/OnboardingGuideModal'
import ErrorBoundary from './components/ErrorBoundary'
import { useOnboardingGuide } from './hooks/useOnboardingGuide'
import BrandLogo from './components/BrandLogo'
import ThemeToggle from './components/ThemeToggle'

// Lazy loaded pages (Item 6)
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const ArtistProfile = lazy(() => import('./pages/ArtistProfile'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Messages = lazy(() => import('./pages/Messages'))
const Projects = lazy(() => import('./pages/Projects'))
const Briefs = lazy(() => import('./pages/Briefs'))
const Payments = lazy(() => import('./pages/Payments'))
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'))
const Account = lazy(() => import('./pages/Account'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Landing = lazy(() => import('./pages/Landing'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const About = lazy(() => import('./pages/About'))
const Help = lazy(() => import('./pages/Help'))
const ArtistApply = lazy(() => import('./pages/ArtistApply'))
const ApplicationStatus = lazy(() => import('./pages/ApplicationStatus'))
const AdminApplications = lazy(() => import('./pages/AdminApplications'))
const AdminInvites = lazy(() => import('./pages/AdminInvites'))
const Disputes = lazy(() => import('./pages/Disputes'))
const AdminDisputes = lazy(() => import('./pages/AdminDisputes'))

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
  const { effectiveRole } = useAuth()
  if (effectiveRole === 'artist') return <Navigate to="/dashboard" replace />
  return <Leaderboard />
}

// Schedule merged into Projects: /bookings now redirects to the Schedule tab,
// preserving the availability-calendar handoff (new -> book) params.
function BookingsRedirect() {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set('view', 'schedule')
  if (next.get('new') === '1') { next.delete('new'); next.set('book', '1') }
  return <Navigate to={`/projects?${next.toString()}`} replace />
}

function formatAccountRole(role) {
  if (!role) return 'Hirer'
  const map = { employer: 'Hirer', artist: 'Artist', admin: 'Admin' }
  return map[role] || role.charAt(0).toUpperCase() + role.slice(1)
}

const APPLICANT_GATE_TIMEOUT_MS = 12000

function ApplicantGate({ children }) {
  const { profile, user, isAdmin } = useAuth()
  const location = useLocation()
  const { application, loading: appLoading } = useMyApplication(profile?.id || user?.id)
  const { artist, loading: artistLoading } = useArtistProfile(profile?.id || user?.id)
  const [gateTimedOut, setGateTimedOut] = useState(false)

  const allowedPaths = ['/application-status', '/account', '/apply']
  const isAllowed = allowedPaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))

  // Only block the whole page on the first load — not on background refetches.
  const gateBlocking =
    (appLoading && application == null) || (artistLoading && artist == null)

  useEffect(() => {
    if (!gateBlocking) {
      setGateTimedOut(false)
      return
    }
    const timer = setTimeout(() => setGateTimedOut(true), APPLICANT_GATE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [gateBlocking])

  if (isAdmin || artist) return children
  if (gateBlocking && !gateTimedOut) return <LoadingScreen />
  if (isPendingApplicant(application) && !isAllowed) {
    return <Navigate to="/application-status" replace />
  }

  return children
}

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut, isMockMode, isAdmin, fetchProfile, adminViewAs, setAdminViewAs, effectiveRole, isAuthenticated, loading: authLoading } = useAuth()
  const { artist, refetch: refetchArtist } = useArtistProfile(profile?.id || user?.id)
  const { applications: adminApplications } = useAdminApplications(isAdmin)
  const { invites: adminInvites } = useAdminInvites(isAdmin)
  const { disputes: adminDisputes } = useDisputes(isAdmin && !adminViewAs)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [personaBusy, setPersonaBusy] = useState(false)
  const [personaError, setPersonaError] = useState(null)
  const { favorites, toggleFavorite } = useFavorites(user?.id)
  const {
    role: onboardingRole,
    open: onboardingOpen,
    showGuide: showOnboardingGuide,
    closeGuide: closeOnboardingGuide,
    dismissGuide: dismissOnboardingGuide,
  } = useOnboardingGuide({
    userId: user?.id,
    isAdmin,
    adminViewAs,
    effectiveRole,
    enabled: isAuthenticated,
    authLoading,
  })

  useEffect(() => {
    if (searchParams.get('guide') !== '1') return
    showOnboardingGuide()
    const next = new URLSearchParams(searchParams)
    next.delete('guide')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, showOnboardingGuide])

  // When admin switches to Artist view, provision a linked artists row so Connect/payouts work.
  useEffect(() => {
    if (!isAdmin || adminViewAs !== 'artist' || !isAuthenticated) return
    if (artist?.id) {
      setPersonaError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setPersonaBusy(true)
      setPersonaError(null)
      try {
        await adminApi.ensureArtistPersona()
        if (!cancelled) await refetchArtist?.()
      } catch (err) {
        if (!cancelled) setPersonaError(err.message || 'Could not create admin test artist persona')
      } finally {
        if (!cancelled) setPersonaBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAdmin, adminViewAs, isAuthenticated, artist?.id, refetchArtist])

  const handleAdminViewAs = (mode) => {
    setPersonaError(null)
    setAdminViewAs(mode)
  }
  const {
    conversations: allMessages,
    sendMessage,
    startConversation: startConversationApi,
    markRead: markConversationRead,
    applyRemoteMessage,
    applyRemoteConversationUpdate,
    refetch: refetchConversations,
  } = useConversations(isAuthenticated)
  const isArtistUser = isArtistProfile(profile)
  const { realtimeConnected } = useMessageRealtime({
    enabled: isAuthenticated,
    profileId: profile?.id,
    isArtist: isArtistUser,
    applyRemoteMessage,
    applyRemoteConversationUpdate,
    refetch: refetchConversations,
  })
  const {
    contracts: localProjects,
    createContract,
    signContract,
    signContractAsArtist,
    refetch: refetchContracts,
    payMilestone,
    approveMilestone,
    submitMilestoneDeliverable,
    requestMilestoneRelease,
  } = useContracts(isAuthenticated)
  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useBookings(isAuthenticated)

  const startConversation = async (artist) => {
    const conv = await startConversationApi(artist)
    navigate('/messages')
    return conv?.id
  }

  const unreadCount = allMessages.filter(m => m.unread).length
  const demoPersona = demoArtistPersona(profile, artist)
  const pendingApplicationCount = adminApplications.filter((a) => a.status === 'pending').length
  const activeInviteCount = adminInvites.filter((i) => !i.usedAt && (!i.expiresAt || new Date(i.expiresAt) > new Date())).length
  const openDisputeCount = adminDisputes.filter((d) => d.status !== 'resolved' && d.status !== 'closed').length

  const navItems = useMemo(() => {
    if (isAdmin && !adminViewAs) {
      return [
        { path: '/admin/applications', icon: FileText, label: 'Applications', badge: pendingApplicationCount || null },
        { path: '/admin/disputes', icon: Shield, label: 'Disputes', badge: openDisputeCount || null },
        { path: '/admin/invites', icon: UserPlus, label: 'Invites', badge: activeInviteCount || null },
        { path: '/home', icon: Trophy, label: 'Artist Database' },
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/briefs', icon: Briefcase, label: 'Open Briefs' },
        { path: '/messages', icon: MessageSquare, label: 'Messages', badge: unreadCount || null },
        { path: '/projects', icon: FileText, label: 'Projects' },
        { path: '/payments', icon: CreditCard, label: 'Payments' },
      ]
    }
    if (effectiveRole === 'artist') {
      const pid = demoPersona?.id ?? artist?.id
      const items = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/briefs', icon: Briefcase, label: 'Open Briefs' },
        { path: '/projects', icon: FileText, label: 'Projects' },
        { path: '/messages', icon: MessageSquare, label: 'Messages', badge: unreadCount || null },
        { path: '/payments', icon: CreditCard, label: 'Earnings' },
        { path: '/disputes', icon: Shield, label: 'Disputes' },
      ]
      if (pid) {
        const profilePath = `/artist/${pid}`
        items.splice(3, 0, { path: profilePath, icon: User, label: 'My profile', matchPrefix: profilePath })
      }
      return items
    }
    return [
      { path: '/', icon: Trophy, label: 'Artist Database' },
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/briefs', icon: Briefcase, label: 'Open Briefs' },
      { path: '/messages', icon: MessageSquare, label: 'Messages', badge: unreadCount || null },
      { path: '/projects', icon: FileText, label: 'Projects' },
      { path: '/payments', icon: CreditCard, label: 'Payments' },
    ]
  }, [effectiveRole, adminViewAs, unreadCount, demoPersona?.id, artist?.id, isAdmin, pendingApplicationCount, activeInviteCount, openDisputeCount])

  const ctx = {
    favorites,
    toggleFavorite,
    allMessages,
    sendMessage,
    startConversation,
    markConversationRead,
    localProjects,
    createContract,
    signContract,
    signContractAsArtist,
    payMilestone,
    approveMilestone,
    submitMilestoneDeliverable,
    requestMilestoneRelease,
    refetchContracts,
    bookings,
    bookingsLoading,
    bookingsError,
    refetchBookings,
    realtimeConnected,
    showOnboardingGuide,
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setMobileNavOpen(false)

    try {
      await signOut()
    } catch (e) {
      console.error('[App] signOut error:', e)
    } finally {
      // Full page navigation guarantees session/UI reset on production (avoids stale router state).
      window.location.assign('/signin')
    }
  }

  useEffect(() => {
    if (user?.id && fetchProfile) {
      fetchProfile(user.id, user)
    }
  }, [user?.id])

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

  const homePath = effectiveRole === 'artist' ? '/dashboard' : '/home'

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
            aria-label="The Callsheet — go to home"
          >
            <BrandLogo variant="compact" />
          </button>
          <div className="mobile-topbar-actions">
            <ThemeToggle variant="compact" />
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
          </div>
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
            aria-label="The Callsheet — AI artist platform, go to home"
          >
            <BrandLogo />
            <span className="sr-only">The Callsheet — AI artist platform</span>
          </button>
          <nav className="sidebar-nav">
            <div className="nav-section">
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
            {isAdmin && (
              <div className="nav-section">
                <div className="nav-label">View as</div>
                <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                  {[null, 'employer', 'artist'].map((mode) => {
                    const label = mode === null ? 'Admin' : mode === 'employer' ? 'Hirer' : 'Artist'
                    const active = adminViewAs === mode
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleAdminViewAs(mode)}
                        disabled={personaBusy && mode === 'artist'}
                        style={{
                          flex: 1, padding: '5px 0', fontSize: 12, fontWeight: 600,
                          borderRadius: 0, border: '1px solid var(--border-strong)',
                          background: active ? 'var(--ink)' : 'transparent',
                          color: active ? 'var(--paper)' : 'var(--text-secondary)',
                          cursor: personaBusy && mode === 'artist' ? 'wait' : 'pointer',
                          transition: 'var(--transition)',
                          opacity: personaBusy && mode === 'artist' ? 0.7 : 1,
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {adminViewAs === 'artist' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, padding: '4px 0 0' }}>
                    {personaBusy
                      ? 'Provisioning test artist persona…'
                      : artist?.id
                        ? 'Test artist ready — use Earnings for Connect, Bookings to confirm.'
                        : 'Switching creates a linked artist profile for payment testing.'}
                  </div>
                )}
                {personaError && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', lineHeight: 1.4, paddingTop: 4 }}>{personaError}</div>
                )}
              </div>
            )}
          </nav>
          <div className="sidebar-footer">
            <div className="nav-section" style={{ marginBottom: 0 }}>
              <div className="nav-label nav-label--with-action">
                <span>Account</span>
                <NotificationPanel />
              </div>
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
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div className="avatar avatar-sm" style={profile?.avatar_url ? {
                  background: `url(${profile.avatar_url}) center/cover no-repeat`,
                  color: 'transparent',
                } : undefined}>
                  {!profile?.avatar_url && (profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile?.full_name || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatAccountRole(profile?.role)}{adminViewAs ? ` · viewing as ${adminViewAs}` : ''}{isMockMode ? ' · demo' : ''}
                  </div>
                </div>
              </div>
              <ThemeToggle showLabel />
              <div className="sidebar-doc-links">
                <button type="button" className="nav-link" onClick={showOnboardingGuide}>
                  Getting started
                </button>
                <button type="button" className="nav-link" onClick={() => goNav('/help')}>
                  Help
                </button>
                <button type="button" className="nav-link" onClick={() => goNav('/about')}>
                  About
                </button>
                <button type="button" className="nav-link" onClick={() => goNav('/terms')}>
                  Terms
                </button>
              </div>
              <button
                type="button"
                className="nav-link sign-out-btn"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-busy={signingOut}
                style={{ marginTop: 4 }}
              >
                <LogOut size={18} aria-hidden /> {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
              {isMockMode && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Mock Personas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm mock-switch-hirer-btn"
                      style={{ fontSize: 11, padding: '4px 8px', width: '100%', justifyContent: 'flex-start', border: '1px dashed var(--border-strong)' }}
                      onClick={() => {
                        localStorage.setItem('mock_user_role', 'employer');
                        localStorage.setItem('mock_user_name', 'Test Hirer');
                        localStorage.setItem('mock_user_email', 'hirer@test.com');
                        window.location.reload();
                      }}
                    >
                      Hirer (Test Hirer)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm mock-switch-artist-btn"
                      style={{ fontSize: 11, padding: '4px 8px', width: '100%', justifyContent: 'flex-start', border: '1px dashed var(--border-strong)' }}
                      onClick={() => {
                        localStorage.setItem('mock_user_role', 'artist');
                        localStorage.setItem('mock_user_name', 'Leo Thorne');
                        localStorage.setItem('mock_user_email', 'leo@thorne.com');
                        localStorage.setItem('mock_artist_profile', JSON.stringify({
                          id: 'artist-002',
                          profileId: 'mock-user-001',
                          displayName: 'Leo Thorne',
                          roleTitle: 'AI Cinematic Director',
                          bio: 'Leo directs AI-native cinematic shorts and high-fidelity video trailers, blending generative video tools with professional sound design.',
                          hourlyRate: 200,
                          location: 'London, UK',
                          available: true,
                          rating: 5.0,
                          projects: 18,
                          skills: ['Runway', 'Sora', 'Pika Labs', 'Premiere Pro'],
                          brands: ['Marvel', 'Netflix', 'Epic Games'],
                          videoLinks: [
                            'https://vimeo.com/347119253',
                            'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                          ]
                        }));
                        window.location.reload();
                      }}
                    >
                      Artist (Leo Thorne)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/home" element={<ProtectedRoute><ApplicantGate><HomeGate /></ApplicantGate></ProtectedRoute>} />
                <Route path="/artist/:id" element={<ProtectedRoute><ApplicantGate><ArtistProfile /></ApplicantGate></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><ApplicantGate><Dashboard /></ApplicantGate></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><ApplicantGate><Messages /></ApplicantGate></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><ApplicantGate><BookingsRedirect /></ApplicantGate></ProtectedRoute>} />
                <Route path="/projects" element={<ProtectedRoute><ApplicantGate><Projects /></ApplicantGate></ProtectedRoute>} />
                <Route path="/briefs" element={<ProtectedRoute><ApplicantGate><Briefs /></ApplicantGate></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><ApplicantGate><Payments /></ApplicantGate></ProtectedRoute>} />
                <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                <Route path="/disputes" element={<ProtectedRoute><ApplicantGate><Disputes /></ApplicantGate></ProtectedRoute>} />
                <Route path="/admin/applications" element={<ProtectedRoute><AdminApplications /></ProtectedRoute>} />
                <Route path="/admin/disputes" element={<ProtectedRoute><AdminDisputes /></ProtectedRoute>} />
                <Route path="/admin/invites" element={<ProtectedRoute><AdminInvites /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        {onboardingRole && (
          <OnboardingGuideModal
            role={onboardingRole}
            open={onboardingOpen}
            onClose={closeOnboardingGuide}
            onDismiss={dismissOnboardingGuide}
          />
        )}
      </div>
    </AppContext.Provider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <PushNotificationSync />
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/apply" element={<ArtistApply />} />
              <Route path="/application-status" element={<ProtectedRoute><ApplicationStatus /></ProtectedRoute>} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/about" element={<About />} />
              <Route path="/help" element={<Help />} />
              <Route path="/*" element={<AppShell />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
