import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Star, Calendar, TrendingUp, Users, DollarSign, FileText, ArrowUpRight, BarChart3, PieChart, Activity, User, MapPin, ChevronRight, Loader2 } from '../components/icons'
import { useArtists } from '../hooks/useData'
import { buildOpenBriefCards } from '../lib/openBriefs'
import { useArtistProfile } from '../hooks/useArtistProfile'
import { usePayments } from '../hooks/usePayments'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { demoArtistPersona } from '../lib/roleView'
import { buildMonthlySeries, buildMonthlyCounts, parseRowDate } from '../lib/analytics'
import { artistReleasedAmount } from '../lib/fees'
import { bookingSubtotal, formatBudgetRange } from '../lib/pricing'
import ArtistAvailabilityEditor from '../components/ArtistAvailabilityEditor'
import { stripeConnect } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'

// Simple bar chart component (pure CSS)
function BarChart({ data, height = 160 }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>${(d.value / 1000).toFixed(1)}k</span>
          <div style={{
            width: '100%', borderRadius: '6px 6px 0 0',
            height: `${(d.value / max) * (height - 40)}px`,
            background: `linear-gradient(180deg, var(--accent), ${i % 2 === 0 ? 'var(--accent-secondary)' : 'var(--accent)'})`,
            transition: 'height 0.6s ease',
            minHeight: 4,
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// Donut chart (pure CSS)
function DonutChart({ segments, size = 120 }) {
  let accumulated = 0
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const gradientParts = segments.map(seg => {
    const start = (accumulated / total) * 360
    accumulated += seg.value
    const end = (accumulated / total) * 360
    return `${seg.color} ${start}deg ${end}deg`
  })
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `conic-gradient(${gradientParts.join(', ')})`,
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: size * 0.6, height: size * 0.6, borderRadius: '50%',
        background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{total}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>total</span>
      </div>
    </div>
  )
}

// Sparkline (pure CSS dots)
function Sparkline({ data, color = 'var(--accent)', height = 40 }) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${data.length * 16} ${height}`} style={{ overflow: 'visible' }}>
      <polyline
        fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        points={data.map((v, i) => `${i * 16 + 8},${height - ((v - min) / range) * (height - 8) - 4}`).join(' ')}
      />
      {data.map((v, i) => (
        <circle key={i} cx={i * 16 + 8} cy={height - ((v - min) / range) * (height - 8) - 4}
          r="3" fill={i === data.length - 1 ? color : 'transparent'} stroke={color} strokeWidth="1.5" />
      ))}
    </svg>
  )
}

function OpenBriefsSection({ projects, emptyMessage, onOpen }) {
  return (
    <section className="spotlight-projects slide-up" style={{ marginBottom: 32 }}>
      <div className="spotlight-projects__head">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Your open briefs</h2>
        <p className="spotlight-projects__sub">
          Live booking requests and contract offers — budgets are for reference; final fees are negotiated in thread.
        </p>
      </div>
      <div className="spotlight-projects__grid">
        {projects.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            {emptyMessage}
          </div>
        ) : (
          projects.map((proj) => (
            <article
              key={proj.id}
              className="spotlight-project-card card slide-up"
              role="button"
              tabIndex={0}
              onClick={() => onOpen?.(proj)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(proj) } }}
              style={{ cursor: 'pointer', ...(proj.isOffer ? { borderColor: 'var(--accent)', borderWidth: 1, borderStyle: 'solid' } : {}) }}
            >
              {proj.isOffer && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Contract offer
                </div>
              )}
              <div className="spotlight-project-card__top">
                <div>
                  <h3 className="spotlight-project-card__title">{proj.title}</h3>
                  <div className="spotlight-project-card__meta">
                    <span className="spotlight-project-card__client">{proj.client}</span>
                    <span className="spotlight-project-card__posted">Posted {proj.posted}</span>
                  </div>
                </div>
                <div className="spotlight-project-card__budget" title="Budget for this brief">
                  <DollarSign size={18} aria-hidden />
                  <span>{formatBudgetRange(proj.budgetMin, proj.budgetMax)}</span>
                </div>
              </div>
              <div className="spotlight-project-card__row">
                <span className="spotlight-project-card__label"><MapPin size={14} aria-hidden /> {proj.location}</span>
                <span className="spotlight-project-card__label">Timeline: {proj.timeline}</span>
              </div>
              {proj.skills.length > 0 && (
                <div className="artist-skills" style={{ marginTop: 10 }}>
                  {proj.skills.map((s) => (
                    <span key={s} className="skill-tag">{s}</span>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, effectiveRole, isAuthenticated } = useAuth()
  const { favorites, localProjects, bookings: allBookings } = useApp()
  const { artists } = useArtists()
  const { artist: myArtistRecord, refetch: refetchMyArtist } = useArtistProfile(profile?.id)
  const { payments: allPayments } = usePayments(isAuthenticated)
  const isArtist = effectiveRole === 'artist'
  const me = demoArtistPersona(profile, myArtistRecord)
  const favArtists = artists.filter((a) => favorites.includes(a.id))
  const [timeRange, setTimeRange] = useState('6m')
  const [payoutReady, setPayoutReady] = useState(null)

  useEffect(() => {
    if (!isArtist || !isSupabaseConfigured) {
      setPayoutReady(null)
      return
    }
    let cancelled = false
    setPayoutReady(null)
    stripeConnect
      .getStatus(myArtistRecord?.stripeAccountId)
      .then((status) => {
        if (!cancelled) setPayoutReady(!!status?.payoutsEnabled)
      })
      .catch(() => {
        if (!cancelled) setPayoutReady(false)
      })
    return () => { cancelled = true }
  }, [isArtist, myArtistRecord?.stripeAccountId])

  const myBookings = useMemo(() => {
    if (!isArtist) return []
    // Prefer artists.id match; if persona isn't ready yet, still show pending/confirmed
    // rows the API already scoped to this artist (avoids empty dashboard flash / wrong-id filter).
    const upcoming = allBookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'pending'
    )
    if (!me?.id) return upcoming
    return upcoming.filter((b) => String(b.artistId) === String(me.id))
  }, [isArtist, me, allBookings])

  const employerBookings = useMemo(
    () => allBookings.filter((b) => b.status === 'confirmed' || b.status === 'pending'),
    [allBookings]
  )

  const myProjects = useMemo(() => (me ? localProjects.filter((p) => p.artistId === me.id) : []), [me, localProjects])
  const myPayments = useMemo(() => allPayments, [allPayments])

  const rangeMap = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }
  const rangeMonths = rangeMap[timeRange] || 6

  // Analytics from real booking/payment data
  const artistIncomeData = useMemo(() => {
    const paid = myPayments.filter((p) => p.status === 'paid' && (p.payoutStatus === 'paid' || p.payoutStatus == null))
    return buildMonthlySeries(
      paid,
      rangeMonths,
      (p) => artistReleasedAmount(p),
      parseRowDate
    )
  }, [myPayments, rangeMonths])

  const monthlySpendData = useMemo(() => {
    const paid = allPayments.filter((p) => p.status === 'paid')
    return buildMonthlySeries(paid, rangeMonths, (p) => p.amount, parseRowDate)
  }, [allPayments, rangeMonths])

  const bookingTrend = useMemo(
    () => buildMonthlyCounts(employerBookings, rangeMonths, parseRowDate),
    [employerBookings, rangeMonths]
  )
  const totalPaidOut = allPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const scheduledSpend = allPayments.filter(p => p.status === 'pending' || p.status === 'upcoming').reduce((s, p) => s + p.amount, 0)

  const roleDistribution = useMemo(() => {
    const counts = {}
    for (const a of artists) {
      const role = a.role || 'Other'
      counts[role] = (counts[role] || 0) + 1
    }
    const colors = ['var(--accent)', 'var(--accent-secondary)', '#f5c542', '#ff4d6a', '#64748b']
    const entries = Object.entries(counts)
    if (entries.length === 0) {
      return [{ label: 'No artists yet', value: 1, color: 'var(--text-muted)' }]
    }
    return entries.map(([label, value], i) => ({
      label,
      value,
      color: colors[i % colors.length],
    }))
  }, [artists])

  const recentActivity = []

  const artistRecentActivity = []



  const acceptedGigs = useMemo(
    () => myBookings.filter((b) => b.status === 'confirmed'),
    [myBookings]
  )

  const gigMix = useMemo(() => {
    const counts = {}
    for (const b of acceptedGigs) {
      const type = b.type || 'Other'
      counts[type] = (counts[type] || 0) + 1
    }
    const colors = ['var(--accent)', 'var(--text-primary)', 'var(--border-hover)', 'var(--accent2)', 'var(--danger)']
    return Object.entries(counts).map(([label, value], i) => ({
      label,
      value,
      color: colors[i % colors.length],
    }))
  }, [acceptedGigs])



  const paidTotal = useMemo(() => {
    return myPayments
      .filter((p) => p.status === 'paid' && (p.payoutStatus === 'paid' || p.payoutStatus == null))
      .reduce((s, p) => s + artistReleasedAmount(p), 0)
  }, [myPayments])

  const upcomingGigs = useMemo(() => {
    return myBookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length
  }, [myBookings])

  const contractOffers = useMemo(() => {
    if (!me) return []
    return localProjects
      .filter((c) => typeof c.id === 'string' && c.artistId === me.id)
      .map((c) => ({
        id: `offer-${c.id}`,
        title: c.title,
        client: c.clientName || 'Client',
        budgetMin: c.value,
        budgetMax: c.value,
        location: 'Remote',
        skills: [],
        posted: c.createdAt ? c.createdAt.slice(0, 10) : 'Today',
        timeline: c.startDate && c.endDate ? `${c.startDate} → ${c.endDate}` : '',
        isOffer: true,
        contractStatus: c.status,
      }))
  }, [me, localProjects])

  const openBriefs = useMemo(
    () =>
      buildOpenBriefCards({
        bookings: isArtist ? myBookings : employerBookings,
        contracts: localProjects,
        isArtist,
        artistId: me?.id,
      }),
    [isArtist, myBookings, employerBookings, localProjects, me?.id]
  )

  const openBrief = (proj) => {
    const id = String(proj.id || '')
    if (id.startsWith('contract-') || id.startsWith('offer-')) {
      navigate(`/projects?contract_id=${id.replace(/^(contract|offer)-/, '')}`)
    } else {
      navigate('/bookings')
    }
  }

  if (isArtist) {
    if (!me) {
      return (
        <div className="page-container">
          <div className="page-header">
            <h1>Dashboard</h1>
            <p>Complete your artist profile to get started.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-row">
          <div>
            <h1>Dashboard</h1>
            <p>Your bookings, projects, and payouts in one place</p>
          </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['1m', '3m', '6m', '1y'].map((r) => (
                <button key={r} className={`btn btn-sm ${timeRange === r ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTimeRange(r)}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {payoutReady === null && isSupabaseConfigured && (
          <div className="stripe-prompt stripe-prompt--action slide-up" style={{ padding: '16px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Loader2 size={18} className="animate-spin" />
              <span className="stripe-prompt__body">Checking payout account…</span>
            </div>
          </div>
        )}

        {payoutReady === false && (
          <div className="stripe-prompt stripe-prompt--warn slide-up">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
              <div className="stripe-prompt__icon" aria-hidden>
                <DollarSign size={24} />
              </div>
              <div>
                <div className="stripe-prompt__eyebrow">Required to get paid</div>
                <div className="stripe-prompt__title">Connect Stripe to receive payouts</div>
                <div className="stripe-prompt__body">
                  Earnings stay in escrow until your Stripe payout account is connected and enabled.
                </div>
              </div>
            </div>
            <div className="stripe-prompt__actions">
              <Link to="/payments" className="btn btn-primary btn-lg">
                Set up payouts <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        )}

        <div className="stats-grid slide-up" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card">
            <span className="stat-label"><DollarSign size={14} /> Released</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>${paidTotal.toLocaleString()}</span>
            <span className="stat-change">All-time earnings</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><Calendar size={14} /> Upcoming gigs</span>
            <span className="stat-value">{upcomingGigs}</span>
            <span className="stat-change">{myBookings.length} total on record</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><FileText size={14} /> Projects</span>
            <span className="stat-value">{myProjects.length}</span>
            <span className="stat-change">{myProjects.filter((p) => p.contractStatus === 'active').length} active</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><Star size={14} /> Rating</span>
            <span className="stat-value">{me.rating ?? '—'}</span>
            <span className="stat-change">{me.role}</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gigMix.length > 0 ? '2fr 1fr' : '1fr',
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div className="card slide-up" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                  <BarChart3 size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Earnings trend
                </h3>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Monthly payouts from your engagements</span>
              </div>
            </div>
            <BarChart data={artistIncomeData} height={180} />
          </div>
          {gigMix.length > 0 && (
            <div className="card slide-up" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 20 }}>
                <PieChart size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Gigs by type
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <DonutChart segments={gigMix} size={130} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {gigMix.map((s) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{s.label}</span>
                      <span style={{ fontWeight: 600 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          <div className="card slide-up" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
              <Activity size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Inquiry volume
            </h3>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }}>Last 12 weeks (sample)</span>
            <Sparkline data={[2, 3, 2, 4, 5, 4, 6, 5, 7, 6, 8, 7]} height={60} />
          </div>
          <div className="card slide-up" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 16 }}>
              <TrendingUp size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Recent activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {artistRecentActivity.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No recent activity yet.</p>
              ) : (
                artistRecentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.time}</div>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </div>

        <ArtistAvailabilityEditor
          artistId={me.id}
          artistName={me.name}
          initialTimeZone={me.timezone || myArtistRecord?.timezone || null}
          onTimeZoneChange={() => refetchMyArtist?.()}
        />

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>Upcoming bookings</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {myBookings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No upcoming bookings. New project requests from clients appear here as pending.
            </div>
          ) : (
            myBookings.map((b) => (
              <div
                key={b.id}
                className="card"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/bookings')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/bookings') }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Calendar size={18} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.type}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {b.date}
                      {b.notes?.startsWith('Created from project:') ? ' · From project' : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>${bookingSubtotal(b).toLocaleString()}</span>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: b.status === 'confirmed' ? 'var(--success-muted-bg)' : 'rgba(245,197,66,0.1)',
                    color: b.status === 'confirmed' ? 'var(--success)' : 'var(--warning)',
                  }}>
                    {b.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <OpenBriefsSection
          projects={[...contractOffers, ...openBriefs]}
          emptyMessage="No open briefs yet. Pending bookings and active contracts appear here."
          onOpen={openBrief}
        />
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Dashboard</h1>
            <p>Your hiring overview and analytics</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['1m', '3m', '6m', '1y'].map(r => (
              <button key={r} className={`btn btn-sm ${timeRange === r ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTimeRange(r)}>{r}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid slide-up" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <span className="stat-label"><DollarSign size={14} /> Paid out</span>
          <span className="stat-value" style={{ color: 'var(--accent)' }}>${totalPaidOut.toLocaleString()}</span>
          <span className="stat-change stat-change--muted">${scheduledSpend.toLocaleString()} scheduled or pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Calendar size={14} /> Bookings</span>
          <span className="stat-value">{employerBookings.length}</span>
          <span className="stat-change"><ArrowUpRight size={12} /> {employerBookings.length} upcoming</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Users size={14} /> Available artists</span>
          <span className="stat-value">{artists.filter((a) => a.available).length}</span>
          <span className="stat-change">{favorites.length} in your favorites</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><FileText size={14} /> Projects</span>
          <span className="stat-value">{localProjects.length}</span>
          <span className="stat-change">${localProjects.reduce((s, p) => s + p.value, 0).toLocaleString()} total</span>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 32 }}>
        <div className="card slide-up" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                <BarChart3 size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Spending over time
              </h3>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Monthly spend on artists and services (your outlay)</span>
            </div>
          </div>
          <BarChart data={monthlySpendData} height={180} />
        </div>

        {/* Distribution */}
        <div className="card slide-up" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
            <PieChart size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Talent by role
          </h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 20 }}>Across the artist database — a discovery snapshot, not your hires</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <DonutChart segments={roleDistribution} size={130} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {roleDistribution.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Trend + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        <div className="card slide-up" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
            <Activity size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Booking Trend
          </h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }}>Bookings per week (last 12 weeks)</span>
          <Sparkline data={bookingTrend} height={60} />
        </div>

        <div className="card slide-up" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 16 }}>
            <TrendingUp size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Recent Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentActivity.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No recent activity yet.</p>
            ) : (
              recentActivity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.time}</div>
                </div>
              </div>
            ))
            )}
          </div>
        </div>
      </div>

      <OpenBriefsSection
        projects={openBriefs}
        emptyMessage="No open briefs yet. Pending bookings and active contracts appear here."
        onOpen={openBrief}
      />

      {/* Projects in Phases */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 20 }}>Your Projects</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        {/* In Progress Projects */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} /> In Progress
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {localProjects.filter(p => p.status === 'active' || p.status === 'pending').map(p => (
              <div key={p.id} className="project-phase-card">
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.artistName} · {p.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Completed Projects */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Completed
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {localProjects.filter(p => p.status === 'completed').map(p => (
              <div key={p.id} className="project-phase-card">
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.artistName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Favorites (moved down) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>Your Favorites</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fees agreed per project with each artist</span>
      </div>
      {favArtists.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', marginBottom: 32 }}>
          <Heart size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No favorites yet. Browse the Artist Database to add artists.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Browse Artists</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
          {favArtists.map(a => (
            <div key={a.id} className="card card-glow" style={{ cursor: 'pointer' }} onClick={() => navigate(`/artist/${a.id}`)}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                <div className="avatar">{a.avatar}</div>
                <div>
                  <h3 style={{ fontSize: 16 }}>{a.name}</h3>
                  <span className="artist-role">{a.role}</span>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={14} fill="var(--gold)" /> {a.rating}
                </div>
              </div>
              <div className="artist-skills">
                {a.skills.slice(0, 3).map(s => <span key={s} className="skill-tag">{s}</span>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Negotiated with client</span>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: a.available ? 'var(--success-muted-bg)' : 'rgba(255,77,106,0.1)',
                  color: a.available ? 'var(--success)' : 'var(--danger)'
                }}>
                  {a.available ? '● Available' : '● Booked'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Bookings */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>Upcoming Bookings</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
        {employerBookings.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No upcoming bookings. Creating a project also sends a pending booking to the artist.
          </div>
        ) : (
          employerBookings.map((b) => (
          <div
            key={b.id}
            className="card"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/bookings')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/bookings') }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{b.artistName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {b.type} · {b.date}
                  {b.notes?.startsWith('Created from project:') ? ' · From project' : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>${bookingSubtotal(b).toLocaleString()}</span>
              <span style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: b.status === 'confirmed' ? 'var(--success-muted-bg)' : 'rgba(245,197,66,0.1)',
                color: b.status === 'confirmed' ? 'var(--success)' : 'var(--warning)'
              }}>
                {b.status}
              </span>
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  )
}
