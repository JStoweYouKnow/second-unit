import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, Heart, Play, Star, MedalGold, MedalSilver, MedalBronze } from '../components/icons'
import { artists } from '../data/mockData'
import { useApp } from '../context/AppContext'
import CalendarModal from '../components/CalendarModal'

export default function Leaderboard() {
  const navigate = useNavigate()
  const { favorites, toggleFavorite } = useApp()
  const [search, setSearch] = useState('')
  const [calendarArtist, setCalendarArtist] = useState(null)
  const [filter, setFilter] = useState('all')

  const roles = [...new Set(artists.map(a => a.role))]

  const filtered = artists
    .filter(a => filter === 'all' || a.role === filter)
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()) ||
      a.skills.some(s => s.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Artist Leaderboard</h1>
            <p>Discover and hire the world's top AI artists and creators</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="search-bar" style={{ width: 300 }}>
              <Search size={16} />
              <input placeholder="Search artists, skills, roles..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>All</button>
          {roles.map(r => (
            <button key={r} className={`btn btn-sm ${filter === r ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(r)}>{r.replace('AI ', '')}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((artist, i) => {
          const rank = i + 1
          const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
          return (
            <div key={artist.id} className="artist-card slide-up" style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => navigate(`/artist/${artist.id}`)}>
              <div className={`artist-rank ${rankClass}`}>
                {rank === 1 ? <MedalGold size={22} /> : rank === 2 ? <MedalSilver size={22} /> : rank === 3 ? <MedalBronze size={22} /> : `#${rank}`}
              </div>
              <div className="artist-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar avatar-sm">{artist.avatar}</div>
                  <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {artist.name}
                      {artist.available && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />}
                    </h3>
                    <div className="artist-meta">
                      <span className="artist-role">{artist.role}</span>
                      <span style={{ color: 'var(--gold)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={12} fill="var(--gold)" /> {artist.rating}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{artist.projects} projects</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                  <div className="artist-skills">
                    {artist.skills.slice(0, 4).map(s => <span key={s} className="skill-tag">{s}</span>)}
                  </div>
                  {artist.videoLinks.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); window.open(artist.videoLinks[0], '_blank') }}
                      style={{ color: 'var(--accent)', fontSize: 12 }}>
                      <Play size={12} /> Reel
                    </button>
                  )}
                  <div className="artist-brands">
                    {artist.brands.map(b => <span key={b} className="brand-logo" title={b}>{b[0]}</span>)}
                  </div>
                </div>
              </div>
              <div className="artist-actions" onClick={e => e.stopPropagation()}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', marginRight: 8 }}>${artist.hourlyRate}/hr</span>
                <button className="btn-icon" title="View Calendar" onClick={() => setCalendarArtist(artist)}>
                  <Calendar size={16} />
                </button>
                <button className="btn-icon" title="Favorite" onClick={() => toggleFavorite(artist.id)}
                  style={favorites.includes(artist.id) ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}>
                  <Heart size={16} fill={favorites.includes(artist.id) ? 'var(--danger)' : 'none'} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {calendarArtist && <CalendarModal artist={calendarArtist} onClose={() => setCalendarArtist(null)} />}
    </div>
  )
}
