import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, Heart, Play, Star, MedalGold, MedalSilver, MedalBronze, Filter, DollarSign, MapPin, Globe, AtSign, ExternalLink } from '../components/icons'
import { artists, availableProjects } from '../data/mockData'
import { useApp } from '../context/AppContext'
import CalendarModal from '../components/CalendarModal'

function formatBudgetRange(min, max) {
  const a = Number(min) || 0
  const b = Number(max) || 0
  return `$${a.toLocaleString()} – $${b.toLocaleString()}`
}

function toggleInSet(set, key) {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

function getEmbedUrl(url) {
  if (!url) return null
  if (url.includes('vimeo.com')) {
    const id = url.split('/').pop()
    return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&background=1`
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let id = ''
    if (url.includes('v=')) {
      id = url.split('v=')[1].split('&')[0]
    } else {
      id = url.split('/').pop().split('?')[0]
    }
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}` : url
  }
  return url
}

function getVideoThumbnail(url) {
  if (!url) return null
  if (url.includes('vimeo.com')) {
    const id = url.split('/').pop()
    return `https://vumbnail.com/${id}.jpg`
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let id = ''
    if (url.includes('v=')) {
      id = url.split('v=')[1].split('&')[0]
    } else {
      // Handle youtu.be/ID?params
      id = url.split('/').pop().split('?')[0]
    }
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
  }
  return null
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const { favorites, toggleFavorite } = useApp()
  const [search, setSearch] = useState('')
  const [calendarArtist, setCalendarArtist] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)

  const [selectedRoles, setSelectedRoles] = useState(() => new Set())
  const [selectedSkills, setSelectedSkills] = useState(() => new Set())
  const [selectedLocations, setSelectedLocations] = useState(() => new Set())
  const [skillMatchMode, setSkillMatchMode] = useState('any')
  const [availableOnly, setAvailableOnly] = useState(false)
  const roleOptions = useMemo(
    () => [...new Set(artists.map(a => a.role))].sort(),
    []
  )
  const skillOptions = useMemo(() => {
    const s = new Set()
    artists.forEach(a => a.skills.forEach(x => s.add(x)))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [])
  const locationOptions = useMemo(
    () => [...new Set(artists.map(a => a.location))].sort(),
    []
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filteredArray = artists.filter((a) => {
      if (selectedRoles.size > 0 && !selectedRoles.has(a.role)) return false

      if (selectedSkills.size > 0) {
        const skills = selectedSkills
        if (skillMatchMode === 'all') {
          if (![...skills].every((s) => a.skills.includes(s))) return false
        } else {
          if (![...skills].some((s) => a.skills.includes(s))) return false
        }
      }

      if (selectedLocations.size > 0 && !selectedLocations.has(a.location)) return false
      if (availableOnly && !a.available) return false

      if (q) {
        const hay = [
          a.name,
          a.role,
          a.location,
          ...a.skills,
          ...a.brands,
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    return filteredArray.sort((a, b) => b.projects - a.projects)
  }, [search, selectedRoles, selectedSkills, selectedLocations, skillMatchMode, availableOnly])

  const activeFilterCount = useMemo(() => {
    let n = selectedRoles.size + selectedSkills.size + selectedLocations.size
    if (availableOnly) n += 1
    return n
  }, [selectedRoles, selectedSkills, selectedLocations, availableOnly])

  const clearFilters = useCallback(() => {
    setSelectedRoles(new Set())
    setSelectedSkills(new Set())
    setSelectedLocations(new Set())
    setSkillMatchMode('any')
    setAvailableOnly(false)
  }, [])

  return (
    <div className="page-container">
      <div className="spotlight-hero">
        <h2 className="spotlight-hero__title">Hire exceptional AI-native creative talent</h2>
        <p className="spotlight-hero__lede">
          Browse verified talent, review open projects with transparent client budgets, and agree fees directly with the client before you book.
        </p>
        <div className="spotlight-hero__trust">
          <span><strong>Stripe</strong> — secure checkout</span>
          <span><strong>Contracts</strong> — e-sign ready</span>
          <span><strong>Messages</strong> — keep context in one thread</span>
        </div>
      </div>

      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Artist Spotlight</h1>
            <p>Discover and hire the world's top AI artists and creators</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <div className="search-bar" style={{ width: 300, maxWidth: '100%' }}>
              <Search size={16} />
              <input
                placeholder="Search name, role, location, skills, brands…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <section className="spotlight-filters" aria-label="Filter artists">
          <div className="spotlight-filters-top">
            <h2>
              <Filter size={16} aria-hidden />
              Refine results
              {activeFilterCount > 0 && (
                <span className="filter-badge">{activeFilterCount} active</span>
              )}
            </h2>
            {activeFilterCount > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                Clear all filters
              </button>
            )}
          </div>

          <div className="spotlight-filters-grid">
            <fieldset>
              <legend>Role</legend>
              <p className="filter-hint">Select one or more specialties. Leave empty to include all roles.</p>
              <div className="filter-toggle-grid">
                {roleOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`filter-toggle ${selectedRoles.has(r) ? 'active' : ''}`}
                    onClick={() => setSelectedRoles((prev) => toggleInSet(prev, r))}
                  >
                    {r.replace(/^AI /, '')}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Tools &amp; skills</legend>
              <div className="filter-row" style={{ marginBottom: 8 }}>
                <label htmlFor="skill-match" className="form-label" style={{ marginBottom: 0 }}>
                  Match
                </label>
                <select
                  id="skill-match"
                  className="filter-select"
                  value={skillMatchMode}
                  onChange={(e) => setSkillMatchMode(e.target.value)}
                >
                  <option value="any">Has any selected skill</option>
                  <option value="all">Has all selected skills</option>
                </select>
              </div>
              <div className="filter-scroll filter-toggle-grid">
                {skillOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`filter-toggle ${selectedSkills.has(s) ? 'active' : ''}`}
                    onClick={() => setSelectedSkills((prev) => toggleInSet(prev, s))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Location</legend>
              <p className="filter-hint">Match artists based in any of the selected cities.</p>
              <div className="filter-toggle-grid">
                {locationOptions.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    className={`filter-toggle ${selectedLocations.has(loc) ? 'active' : ''}`}
                    onClick={() => setSelectedLocations((prev) => toggleInSet(prev, loc))}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Availability</legend>
              <label className="filter-checkbox" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                />
                Available for new work only
              </label>
            </fieldset>
          </div>

          <p className="spotlight-results-meta">
            Showing <strong>{filtered.length}</strong> of {artists.length} artists
            {filtered.length === 0 && ' — try broadening filters or search.'}
          </p>
        </section>
      </div>

      <div className="artist-gallery-grid">
        {filtered.map((artist, i) => {
          const rank = i + 1
          // Use video thumbnail if available, otherwise fallback to generated or null
          const videoThumb = artist.videoLinks?.length > 0 ? getVideoThumbnail(artist.videoLinks[0]) : null
          
          const fallbackThumb = i === 0 ? '/Users/v/.gemini/antigravity/brain/9dc5a748-79f9-42e5-ae4f-5345ea3cb839/ai_artist_portfolio_1_1777161530365.png' 
                        : i === 1 ? '/Users/v/.gemini/antigravity/brain/9dc5a748-79f9-42e5-ae4f-5345ea3cb839/ai_artist_portfolio_2_1777161543445.png'
                        : i === 2 ? '/Users/v/.gemini/antigravity/brain/9dc5a748-79f9-42e5-ae4f-5345ea3cb839/ai_artist_portfolio_3_1777161554677.png'
                        : null
          
          const thumbUrl = videoThumb || fallbackThumb

          return (
            <div
              key={artist.id}
              className="artist-tile slide-up"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => navigate(`/artist/${artist.id}`)}
              onMouseEnter={() => setHoveredId(artist.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              
              <div 
                className="artist-tile__media-container"
                style={{ position: 'relative', width: '100%', height: '100%' }}
              >
                {thumbUrl && (
                  <img 
                    src={thumbUrl} 
                    alt={artist.name} 
                    className={`artist-tile__img ${hoveredId === artist.id && artist.videoLinks?.length > 0 ? 'is-hidden' : ''}`} 
                  />
                )}
                
                {hoveredId === artist.id && artist.videoLinks?.length > 0 && (
                  <div className="artist-tile__video-wrapper">
                    {artist.videoLinks[0].endsWith('.mp4') ? (
                      <video
                        src={artist.videoLinks[0]}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                      />
                    ) : (
                      <iframe
                        src={getEmbedUrl(artist.videoLinks[0])}
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        title={`${artist.name} reel`}
                      />
                    )}
                  </div>
                )}

                {!thumbUrl && !artist.videoLinks?.length && (
                  <div className="artist-tile__img" />
                )}
              </div>
              
              <div className="artist-tile__overlay">
                <div className="artist-tile__role">{artist.role}</div>
                <div className="artist-tile__name">{artist.name}</div>
                
                <div className="artist-tile__links" onClick={(e) => e.stopPropagation()}>
                  {artist.socials?.website && (
                    <a href={artist.socials.website} target="_blank" rel="noopener noreferrer" className="artist-tile__link-icon" title="Website">
                      <Globe size={18} />
                    </a>
                  )}
                  <a href="#" className="artist-tile__link-icon" title="Socials">
                    <AtSign size={18} />
                  </a>
                  {artist.videoLinks?.length > 0 && (
                    <a href={artist.videoLinks[0]} target="_blank" rel="noopener noreferrer" className="artist-tile__link-icon" title="Reel">
                      <Play size={18} />
                    </a>
                  )}
                  <button 
                    type="button" 
                    className="artist-tile__link-icon" 
                    style={{ background: 'none', border: 'none', padding: 0 }}
                    onClick={() => toggleFavorite(artist.id)}
                    title="Favorite"
                  >
                    <Heart size={18} fill={favorites.includes(artist.id) ? 'var(--danger)' : 'none'} color={favorites.includes(artist.id) ? 'var(--danger)' : 'white'} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gold)', fontSize: 13, fontWeight: 700 }}>
                    <Star size={14} fill="var(--gold)" /> {artist.rating}
                  </div>
                  {artist.available && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>
                      ● Available
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {calendarArtist && <CalendarModal artist={calendarArtist} onClose={() => setCalendarArtist(null)} />}
    </div>
  )
}
