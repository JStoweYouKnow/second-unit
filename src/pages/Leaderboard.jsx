import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, Heart, Play, Star, MedalGold, MedalSilver, MedalBronze, Filter } from '../components/icons'
import { artists } from '../data/mockData'
import { useApp } from '../context/AppContext'
import CalendarModal from '../components/CalendarModal'
import PricingModeToggle from '../components/PricingModeToggle'
import { formatArtistRate } from '../lib/pricing'

function toggleInSet(set, key) {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const { favorites, toggleFavorite, pricingMode } = useApp()
  const [search, setSearch] = useState('')
  const [calendarArtist, setCalendarArtist] = useState(null)

  const [selectedRoles, setSelectedRoles] = useState(() => new Set())
  const [selectedSkills, setSelectedSkills] = useState(() => new Set())
  const [selectedLocations, setSelectedLocations] = useState(() => new Set())
  const [skillMatchMode, setSkillMatchMode] = useState('any')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [minRating, setMinRating] = useState(0)

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
    return artists.filter((a) => {
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
      if (minRating > 0 && a.rating < minRating) return false

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
  }, [
    search,
    selectedRoles,
    selectedSkills,
    selectedLocations,
    skillMatchMode,
    availableOnly,
    minRating,
  ])

  const activeFilterCount = useMemo(() => {
    let n = selectedRoles.size + selectedSkills.size + selectedLocations.size
    if (availableOnly) n += 1
    if (minRating > 0) n += 1
    return n
  }, [selectedRoles, selectedSkills, selectedLocations, availableOnly, minRating])

  const clearFilters = useCallback(() => {
    setSelectedRoles(new Set())
    setSelectedSkills(new Set())
    setSelectedLocations(new Set())
    setSkillMatchMode('any')
    setAvailableOnly(false)
    setMinRating(0)
  }, [])

  return (
    <div className="page-container">
      <div className="spotlight-hero">
        <p className="spotlight-hero__eyebrow">Launch-ready marketplace</p>
        <h2 className="spotlight-hero__title">Hire exceptional AI-native creative talent</h2>
        <p className="spotlight-hero__lede">
          Browse verified artists, compare rates, and move from discovery to booking without leaving the platform.
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
            <PricingModeToggle compact />
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
              <legend>Availability &amp; rating</legend>
              <label className="filter-checkbox" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                />
                Available for new work only
              </label>
              <div className="filter-row">
                <label htmlFor="min-rating" className="form-label" style={{ marginBottom: 0 }}>
                  Min. rating
                </label>
                <select
                  id="min-rating"
                  className="filter-select"
                  value={minRating === 0 ? '' : String(minRating)}
                  onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : 0)}
                >
                  <option value="">Any</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.6">4.6+</option>
                  <option value="4.7">4.7+</option>
                  <option value="4.8">4.8+</option>
                  <option value="4.9">4.9+</option>
                </select>
              </div>
            </fieldset>
          </div>

          <p className="spotlight-results-meta">
            Showing <strong>{filtered.length}</strong> of {artists.length} artists
            {filtered.length === 0 && ' — try broadening filters or search.'}
          </p>
        </section>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((artist, i) => {
          const rank = i + 1
          const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
          return (
            <div
              key={artist.id}
              className="artist-card slide-up"
              style={{ animationDelay: `${i * 0.05}s` }}
              tabIndex={0}
              aria-label={`View profile: ${artist.name}`}
              onClick={() => navigate(`/artist/${artist.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/artist/${artist.id}`)
                }
              }}
            >
              <div className={`artist-rank ${rankClass}`}>
                {rank === 1 ? (
                  <MedalGold size={22} />
                ) : rank === 2 ? (
                  <MedalSilver size={22} />
                ) : rank === 3 ? (
                  <MedalBronze size={22} />
                ) : (
                  `#${rank}`
                )}
              </div>
              <div className="artist-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar avatar-sm">{artist.avatar}</div>
                  <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {artist.name}
                      {artist.available && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--success)',
                            display: 'inline-block',
                          }}
                        />
                      )}
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
                    {artist.skills.slice(0, 4).map((s) => (
                      <span key={s} className="skill-tag">
                        {s}
                      </span>
                    ))}
                  </div>
                  {artist.videoLinks.length > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(artist.videoLinks[0], '_blank')
                      }}
                      style={{ color: 'var(--accent)', fontSize: 12 }}
                    >
                      <Play size={12} /> Reel
                    </button>
                  )}
                  <div className="artist-brands">
                    {artist.brands.map((b) => (
                      <span key={b} className="brand-logo" title={b}>
                        {b[0]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="artist-actions" onClick={(e) => e.stopPropagation()}>
                <span
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    marginRight: 8,
                  }}
                >
                  {formatArtistRate(pricingMode, artist)}
                </span>
                <button className="btn-icon" title="View Calendar" onClick={() => setCalendarArtist(artist)}>
                  <Calendar size={16} />
                </button>
                <button
                  className="btn-icon"
                  title="Favorite"
                  onClick={() => toggleFavorite(artist.id)}
                  style={favorites.includes(artist.id) ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}
                >
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
