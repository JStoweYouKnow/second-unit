import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Heart, Star, MapPin, Calendar, Play, Globe, IconX, Instagram, LinkedIn, Send, ChevronLeft, ChevronRight } from '../components/icons'
import { useApp } from '../context/AppContext'
import { useState, useEffect, useRef, useCallback } from 'react'
import CalendarModal from '../components/CalendarModal'
import { useAuth } from '../context/AuthContext'
import { artists as artistsApi } from '../lib/api'
import BrandChip from '../components/BrandChip'
import { isArtistProfile } from '../lib/roleView'
import { useArtist } from '../hooks/useData'
import { useArtistReviews } from '../hooks/useArtistReviews'
import HirerReviewForm from '../components/HirerReviewForm'
import ReviewList from '../components/ReviewList'
import { resolveProfileHero } from '../lib/profileHero'
import { normalizeSocialUrl } from '../lib/socialLinks'
import {
  normalizeVideoReels,
  videoReelTitle,
  videoReelUrl,
} from '../lib/videoReels'
import VideoPlayer from '../components/VideoPlayer'
import ArtistMyProfileEditor from '../components/ArtistMyProfileEditor'


export default function ArtistProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { favorites, toggleFavorite, startConversation } = useApp()
  const { profile, isAdmin } = useAuth()
  const [showCalendar, setShowCalendar] = useState(false)
  const [activeTab, setActiveTab] = useState('portfolio')
  const [brandBusy, setBrandBusy] = useState(null)
  const [localBrands, setLocalBrands] = useState(null)
  const { artist, loading: artistLoading, refetch: refetchArtist } = useArtist(id)
  const reviewState = useArtistReviews(id)

  useEffect(() => {
    if (searchParams.get('tab') === 'reviews') setActiveTab('reviews')
  }, [searchParams])

  const isOwnProfile = isArtistProfile(profile) && artist?.profileId === profile?.id
  const isHirer = profile && !isArtistProfile(profile)
  const viewAsPublic = searchParams.get('view') === 'public'

  useEffect(() => {
    setLocalBrands(null)
  }, [artist?.id])

  const displayBrands = localBrands ?? artist?.brands ?? []

  const handleVerifyBrand = async (brandName, verified) => {
    if (!artist?.id || !isAdmin) return
    setBrandBusy(brandName)
    try {
      const updated = await artistsApi.verifyBrand(artist.id, brandName, verified)
      setLocalBrands((prev) => {
        const base = prev ?? artist.brands ?? []
        return base.map((b) =>
          (typeof b === 'string' ? b : b.name) === updated.name
            ? { name: updated.name, verified: updated.verified }
            : b
        )
      })
    } catch (err) {
      window.alert(err.message || 'Could not update brand verification')
    } finally {
      setBrandBusy(null)
    }
  }

  const [portfolioItems, setPortfolioItems] = useState([])
  const [videoLinks, setVideoLinks] = useState([])

  function mapPortfolioRow(p) {
    const url = p.media_url || p.image || p.video
    const isVideo = p.media_type === 'video' || !!p.video
    return {
      id: p.id,
      title: p.title || 'Portfolio',
      image: isVideo ? null : url,
      video: isVideo ? url : null,
      colorIdx: p.colorIdx ?? 0,
      storagePath: p.storage_path ?? null,
    }
  }

  useEffect(() => {
    if (artist?.portfolio?.length) {
      setPortfolioItems(artist.portfolio.map(mapPortfolioRow))
    } else {
      setPortfolioItems([])
    }
  }, [artist?.portfolio])

  useEffect(() => {
    if (artist?.videoLinks) setVideoLinks(normalizeVideoReels(artist.videoLinks))
  }, [artist?.videoLinks])

  if (artistLoading) return <div className="page-container" style={{ paddingTop: 80, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
  if (!artist) return <div className="page-container"><p>Artist not found.</p></div>

  if (artist.isPublic === false && !isOwnProfile && !isAdmin) {
    return <div className="page-container"><p>Artist not found.</p></div>
  }

  if (isOwnProfile && !viewAsPublic) {
    return (
      <div className="page-container">
        <ArtistMyProfileEditor
          artistId={artist.id}
          onUpdated={() => refetchArtist?.()}
        />
      </div>
    )
  }

  const {
    settings: reviewSettings,
    allReviews,
    publicReviews,
    publicAverage,
    submitReview,
    submitReviewResponse,
    hirerExistingReview,
  } = reviewState

  const getVideoThumb = (url) => {
    if (!url) return null
    if (url.includes('vimeo.com')) return `https://vumbnail.com/${url.split('/').pop()}.jpg`
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const id = url.includes('v=')
        ? new URL(url).searchParams.get('v')
        : url.split('/').pop().split('?')[0]
      return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
    }
    return null
  }

  const { heroVideo, heroImg } = resolveProfileHero({
    portfolioItems,
    videoLinks,
    headerImageUrl: artist.headerImageUrl,
    featuredPortfolioItemId: artist.featuredPortfolioItemId,
    featuredVideoLink: artist.featuredVideoLink,
    getVideoThumb,
  })
  const hasHeroVisual = !!(heroVideo || heroImg)

  const isFav = favorites.includes(artist.id)
  const hirerReview = isHirer ? hirerExistingReview(profile.id) : null
  const reviewsForDisplay = isOwnProfile ? allReviews : publicReviews
  const showRatingToHirer = isHirer && reviewSettings.showReviewsOnProfile && publicReviews.length > 0
  const heroRating = showRatingToHirer || isOwnProfile
    ? (publicAverage ?? artist.rating)
    : null
  const heroReviewCount = isOwnProfile ? publicReviews.length : publicReviews.length

  return (
    <div>
      <div
        className={`profile-hero slide-up${hasHeroVisual ? ' profile-hero--visual' : ''}`}
        style={heroImg && !heroVideo ? { backgroundImage: `url(${heroImg})` } : undefined}
      >
        <button
          className={`btn btn-ghost${hasHeroVisual ? ' profile-hero__back' : ''}`}
          onClick={() => navigate(-1)}
          style={!hasHeroVisual ? { margin: '24px 0 16px 32px', display: 'block' } : undefined}
        >
          <ArrowLeft size={16} /> Back
        </button>
        {heroVideo && (
          <video className="profile-hero__bg-video" autoPlay muted loop playsInline>
            <source src={heroVideo} type="video/mp4" />
          </video>
        )}
        {hasHeroVisual && <div className="profile-hero__gradient" />}
        <div className="profile-hero-content">
          <div className="profile-hero-main">
            {!hasHeroVisual && <div className="avatar avatar-lg">{artist.avatar}</div>}
            <div className="profile-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1>{artist.name}</h1>
                {artist.available && (
                  <span style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--success-muted-bg)', color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>
                    ● Available
                  </span>
                )}
              </div>
              <div className="role">{artist.role}</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {heroRating != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gold)', fontSize: 14, fontWeight: 600 }}>
                    <Star size={14} fill="var(--gold)" />
                    {heroRating}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      ({heroReviewCount} public review{heroReviewCount === 1 ? '' : 's'})
                    </span>
                  </span>
                )}
                {isHirer && !reviewSettings.showReviewsOnProfile && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reviews not shown publicly</span>
                )}
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{artist.projects} projects</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 14 }}>
                  <MapPin size={14} /> {artist.location}
                </span>
              </div>
              <div className="profile-socials">
                {[
                  { value: artist.socials?.twitter, platform: 'twitter', title: 'X (Twitter)', Icon: IconX },
                  { value: artist.socials?.instagram, platform: 'instagram', title: 'Instagram', Icon: Instagram },
                  { value: artist.socials?.linkedin, platform: 'linkedin', title: 'LinkedIn', Icon: LinkedIn },
                  { value: artist.socials?.website, platform: 'website', title: 'Website', Icon: Globe },
                ]
                  .map((item) => ({ ...item, href: normalizeSocialUrl(item.value, item.platform) }))
                  .filter(({ href }) => href)
                  .map(({ href, title, Icon }) => (
                    <a
                      key={title}
                      href={href}
                      className="social-btn"
                      title={title}
                      aria-label={title}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon size={16} />
                    </a>
                  ))}
              </div>
            </div>
          </div>

          <div className="profile-hero-meta">
            {displayBrands.length > 0 && (
              <div className="profile-hero-brands">
                <span className="profile-hero-meta-label">Brands & Clients</span>
                <div className="profile-hero-brands-list">
                  {displayBrands.map((b) => (
                    <BrandChip
                      key={typeof b === 'string' ? b : b.name}
                      brand={b}
                      onVerify={isAdmin ? handleVerifyBrand : undefined}
                      verifyBusy={brandBusy === (typeof b === 'string' ? b : b.name)}
                    />
                  ))}
                </div>
                {isAdmin && (
                  <p className="profile-hero-meta-hint">Admin: verify credits after confirming client work.</p>
                )}
              </div>
            )}
            <div className="profile-hero-stats">
                <div className="profile-hero-stat">
                  <span className="profile-hero-stat-label">Projects</span>
                  <span className="profile-hero-stat-value">{artist.projects}</span>
                </div>
                {(showRatingToHirer || (isOwnProfile && publicReviews.length > 0)) && (
                  <div className="profile-hero-stat">
                    <span className="profile-hero-stat-label">Public rating</span>
                    <span className="profile-hero-stat-value profile-hero-stat-value--gold">
                      {publicAverage ?? artist.rating} ★
                    </span>
                  </div>
                )}
                {isOwnProfile && (
                  <div className="profile-hero-stat">
                    <span className="profile-hero-stat-label">Reviews</span>
                    <span className="profile-hero-stat-value">{allReviews.length}</span>
                  </div>
                )}
                <div className="profile-hero-stat">
                  <span className="profile-hero-stat-label">Member since</span>
                  <span className="profile-hero-stat-value">
                    {new Date(artist.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="page-container" style={{ paddingTop: 8 }}>
      {isOwnProfile && viewAsPublic && (
        <div
          className="card slide-up"
          style={{
            marginBottom: 20,
            padding: '14px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: 'var(--accent-tint-border, var(--border))',
            background: 'var(--accent-tint-05, var(--surface))',
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Public preview — this is what hirers see.
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/artist/${artist.id}`)}>
            Back to edit
          </button>
        </div>
      )}
      <div className="profile-actions-bar">
        {!isOwnProfile && (
          <button className="btn btn-primary btn-lg" onClick={() => startConversation(artist)}>
            <Send size={16} /> Hire / Inquire
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => setShowCalendar(true)}>
          <Calendar size={16} /> View Calendar
        </button>
        <button className="btn btn-ghost" onClick={() => toggleFavorite(artist.id)}
          style={isFav ? { color: 'var(--danger)' } : {}}>
          <Heart size={16} fill={isFav ? 'var(--danger)' : 'none'} />
          {isFav ? 'Favorited' : 'Add to Favorites'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div className="tabs">
            {['portfolio', 'about', 'reviews'].map((t) => (
              <button
                key={t}
                type="button"
                className={`tab ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t === 'reviews'
                  ? `Reviews${!isOwnProfile && publicReviews.length ? ` (${publicReviews.length})` : ''}`
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'about' && (
            <div className="card slide-up">
              <h3 style={{ marginBottom: 12 }}>About</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>{artist.bio}</p>
              <h4 style={{ marginTop: 24, marginBottom: 12 }}>Technical Expertise</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {artist.skills.map(s => <span key={s} className="skill-tag" style={{ fontSize: 13, padding: '6px 14px' }}>{s}</span>)}
              </div>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="slide-up">
              {portfolioItems.length === 0 && videoLinks.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  No portfolio items yet.
                </div>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {portfolioItems.map((item, i) => (
                  <div key={item.id} className="card" style={{
                    height: i === 0 ? 400 : 260,
                    gridColumn: i === 0 ? '1 / -1' : undefined,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: item.image ? `url(${item.image}) center/cover no-repeat` : (item.video ? 'black' : `linear-gradient(${135 + item.colorIdx * 30}deg, var(--accent-tint-12), rgba(56, 189, 248, 0.08))`),
                    fontSize: 14, color: (item.image || item.video) ? 'transparent' : 'var(--text-muted)',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid var(--border)'
                  }}>
                    {item.video && (
                      <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      >
                        <source src={item.video} type="video/mp4" />
                      </video>
                    )}

                    {(!item.image && !item.video) && item.title}

                    {(item.image || item.video) && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '12px 16px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: 13,
                        zIndex: 1,
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
              {videoLinks.length > 0 && <VideoReelRow videoLinks={videoLinks} />}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isHirer && (
                <HirerReviewForm
                  existingReview={hirerReview}
                  hirerName={profile.full_name || 'Client'}
                  onSubmit={(payload) =>
                    submitReview({
                      hirerId: profile.id,
                      hirerName: profile.full_name || 'Client',
                      ...payload,
                    })
                  }
                />
              )}

              <ReviewList
                reviews={reviewsForDisplay}
                isOwnProfile={isOwnProfile}
                onReply={isOwnProfile ? submitReviewResponse : undefined}
              />
            </div>
          )}
        </div>
      </div>

      </div>

      {showCalendar && (
        <CalendarModal
          artist={artist}
          onClose={() => setShowCalendar(false)}
          onBook={({ artist: a, date, time, duration, durationUnit }) => {
            setShowCalendar(false)
            const params = new URLSearchParams({
              new: '1',
              artistId: String(a.id),
              date,
              time: time || '09:00',
              duration: String(duration),
              durationUnit: durationUnit || 'hours',
            })
            navigate(`/bookings?${params.toString()}`)
          }}
        />
      )}
    </div>
  )
}

function VideoReelRow({ videoLinks }) {
  const scrollRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanLeft(scrollLeft > 4)
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, videoLinks.length])

  const scrollBy = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: 'smooth' })
  }

  return (
    <div className="video-reel-list" style={{ marginTop: 28 }}>
      <h3 style={{ marginBottom: 16 }}>Video Reels</h3>
      <div className="video-reel-viewport">
        <button
          type="button"
          className={`video-reel-arrow video-reel-arrow--left ${canLeft ? '' : 'is-hidden'}`}
          aria-label="Scroll to previous videos"
          onClick={() => scrollBy(-1)}
        >
          <ChevronLeft size={22} />
        </button>
        <div className="video-reel-scroll" role="list" aria-label="Video reels" ref={scrollRef}>
          {videoLinks.map((reel, i) => {
            const url = videoReelUrl(reel)
            const label = videoReelTitle(reel, i)
            return (
              <div
                key={url || `reel-${i}`}
                className="card video-reel-item"
                role="listitem"
                style={{ padding: 0, overflow: 'hidden' }}
              >
                <VideoPlayer url={url} thumbnail={reel.thumbnail} title={label} />
                <div className="video-player__caption">
                  <Play size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{label}</span>
                </div>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          className={`video-reel-arrow video-reel-arrow--right ${canRight ? '' : 'is-hidden'}`}
          aria-label="Scroll to more videos"
          onClick={() => scrollBy(1)}
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  )
}
