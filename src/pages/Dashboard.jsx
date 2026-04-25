import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Star, Calendar, TrendingUp, Users, DollarSign, FileText, ArrowUpRight, BarChart3, PieChart, Activity, User } from '../components/icons'
import { artists, bookings, contracts, payments } from '../data/mockData'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { isArtistProfile, demoArtistPersona } from '../lib/roleView'
import { bookingSubtotal } from '../lib/pricing'

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

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { favorites } = useApp()
  const isArtist = isArtistProfile(profile)
  const me = demoArtistPersona(profile)
  const favArtists = artists.filter(a => favorites.includes(a.id))
  const [timeRange, setTimeRange] = useState('6m')

  const myBookings = useMemo(() => (me ? bookings.filter((b) => b.artistId === me.id) : []), [me])
  const myContracts = useMemo(() => (me ? contracts.filter((c) => c.artistId === me.id) : []), [me])
  const myPayments = useMemo(() => (me ? payments.filter((p) => p.artistName === me.name) : []), [me])

  // Mock analytics data
  const monthlySpendData = [
    { label: 'Oct', value: 4200 }, { label: 'Nov', value: 6800 }, { label: 'Dec', value: 3500 },
    { label: 'Jan', value: 8200 }, { label: 'Feb', value: 5600 }, { label: 'Mar', value: 9800 },
    { label: 'Apr', value: 7400 },
  ]

  const bookingTrend = [3, 5, 4, 7, 6, 8, 5, 9, 7, 11, 8, 10]
  const totalPaidOut = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const scheduledSpend = payments.filter(p => p.status === 'pending' || p.status === 'upcoming').reduce((s, p) => s + p.amount, 0)

  const roleDistribution = [
    { label: 'Visual Artist', value: 3, color: 'var(--accent)' },
    { label: 'Motion Designer', value: 2, color: 'var(--accent-secondary)' },
    { label: 'Music Producer', value: 2, color: '#f5c542' },
    { label: '3D Artist', value: 1, color: '#ff4d6a' },
    { label: 'Other', value: 2, color: '#64748b' },
  ]

  const recentActivity = [
    { type: 'booking', text: 'Booking confirmed with Maya Chen', time: '2h ago', color: 'var(--success)' },
    { type: 'payment', text: 'You sent $5,000 to an artist (milestone)', time: '5h ago', color: 'var(--accent)' },
    { type: 'contract', text: 'Contract signed by Theo Park', time: '1d ago', color: 'var(--warning)' },
    { type: 'message', text: 'New message from Dex Okafor', time: '1d ago', color: 'var(--accent-secondary)' },
    { type: 'booking', text: 'Booking request sent to Aria Nakamura', time: '2d ago', color: 'var(--success)' },
  ]

  const artistRecentActivity = [
    { type: 'booking', text: 'New booking request for a consultation', time: '2h ago', color: 'var(--success)' },
    { type: 'payment', text: 'Milestone marked paid by client', time: '5h ago', color: 'var(--accent)' },
    { type: 'message', text: 'Client asked about timeline', time: '1d ago', color: 'var(--accent-secondary)' },
    { type: 'contract', text: 'Contract ready for your signature', time: '1d ago', color: 'var(--warning)' },
  ]

  const artistIncomeData = [
    { label: 'Oct', value: 2100 }, { label: 'Nov', value: 3400 }, { label: 'Dec', value: 1800 },
    { label: 'Jan', value: 4100 }, { label: 'Feb', value: 2800 }, { label: 'Mar', value: 4900 },
    { label: 'Apr', value: 3700 },
  ]

  const gigMix = useMemo(() => {
    const counts = {}
    for (const b of myBookings) {
      counts[b.type] = (counts[b.type] || 0) + 1
    }
    const colors = ['var(--accent)', 'var(--accent-secondary)', '#f5c542', '#ff4d6a', '#64748b']
    const entries = Object.entries(counts)
    if (entries.length === 0) {
      return [{ label: 'No gigs yet', value: 1, color: 'var(--text-muted)' }]
    }
    return entries.map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
  }, [myBookings])

  const paidTotal = myPayments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const upcomingGigs = myBookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length

  if (isArtist && me) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-row">
            <div>
              <h1>Studio</h1>
              <p>Your bookings, contracts, and payouts in one place</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['1m', '3m', '6m', '1y'].map((r) => (
                <button key={r} className={`btn btn-sm ${timeRange === r ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTimeRange(r)}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="stats-grid slide-up" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card">
            <span className="stat-label"><DollarSign size={14} /> Paid (demo)</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>${paidTotal.toLocaleString()}</span>
            <span className="stat-change">After platform fees in production</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><Calendar size={14} /> Upcoming gigs</span>
            <span className="stat-value">{upcomingGigs}</span>
            <span className="stat-change">{myBookings.length} total on record</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><FileText size={14} /> Contracts</span>
            <span className="stat-value">{myContracts.length}</span>
            <span className="stat-change">{myContracts.filter((c) => c.status === 'active').length} active</span>
          </div>
          <div className="stat-card">
            <span className="stat-label"><Star size={14} /> Rating</span>
            <span className="stat-value">{me.rating}</span>
            <span className="stat-change">{me.role}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 32 }}>
          <div className="card slide-up" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                  <BarChart3 size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> Earnings trend
                </h3>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Illustrative monthly payouts (mock data)</span>
              </div>
            </div>
            <BarChart data={artistIncomeData} height={180} />
          </div>
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
              {artistRecentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>Your public profile</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/artist/${me.id}`)}>
            <User size={14} /> View as clients see it
          </button>
        </div>
        <div className="card card-glow slide-up" style={{ padding: 24, marginBottom: 32, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="avatar" style={{ fontSize: 28 }}>{me.avatar}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: 18, marginBottom: 4 }}>{me.name}</h3>
            <span className="artist-role">{me.role}</span>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
              Demo mapping: your account is linked to this roster profile so bookings and payouts stay in sync while we wire real profiles.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Spotlight visibility</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>High</div>
          </div>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>Upcoming bookings</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myBookings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No bookings assigned to this demo profile yet.
            </div>
          ) : (
            myBookings.map((b) => (
              <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Calendar size={18} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.type}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{b.date} at {b.time}</div>
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
          <span className="stat-value">{bookings.length}</span>
          <span className="stat-change"><ArrowUpRight size={12} /> 3 this month</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><Users size={14} /> Active Artists</span>
          <span className="stat-value">{artists.filter(a => a.available).length}</span>
          <span className="stat-change">{favorites.length} favorited</span>
        </div>
        <div className="stat-card">
          <span className="stat-label"><FileText size={14} /> Contracts</span>
          <span className="stat-value">{contracts.length}</span>
          <span className="stat-change">${contracts.reduce((s, c) => s + c.value, 0).toLocaleString()} total</span>
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
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 20 }}>
            <PieChart size={16} style={{ marginRight: 6, color: 'var(--accent)' }} /> By Role
          </h3>
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
            {recentActivity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Favorites */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>Your Favorites</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Fees agreed per project with each artist</span>
      </div>
      {favArtists.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <Heart size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No favorites yet. Browse Artist Spotlight to add artists.</p>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bookings.map(b => (
          <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{b.artistName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{b.type} · {b.date} at {b.time}</div>
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
        ))}
      </div>
    </div>
  )
}
