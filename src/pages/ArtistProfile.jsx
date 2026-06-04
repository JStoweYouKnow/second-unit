import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Star, MapPin, Calendar, ExternalLink, Play, Globe, AtSign, Camera, Briefcase, Send, ChevronUp, ChevronDown } from '../components/icons'
import { useApp } from '../context/AppContext'
import { useState, useEffect } from 'react'
import CalendarModal from '../components/CalendarModal'
import { useAuth } from '../context/AuthContext'
import { isArtistProfile, demoArtistPersona } from '../lib/roleView'
import { useArtist } from '../hooks/useData'
import { useArtistReviews } from '../hooks/useArtistReviews'
import HirerReviewForm from '../components/HirerReviewForm'
import ArtistReviewSettings from '../components/ArtistReviewSettings'
import ReviewList from '../components/ReviewList'
function VideoPlayer({ url }) {
  const getEmbedUrl = (url) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      let id = '';
      if (url.includes('v=')) id = new URL(url).searchParams.get('v');
      else id = url.split('/').pop();
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  };

  const embedUrl = getEmbedUrl(url);

  if (embedUrl) {
    return (
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000' }}>
        <iframe
          src={embedUrl}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <video controls style={{ width: '100%', display: 'block', background: '#000' }}>
      <source src={url} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
}

const DEFAULT_PORTFOLIO = [
  { id: 1, title: 'Liquid Metal Campaign', image: '/demo/portfolio-1.png' },
  { id: 2, title: 'Nature Motion Study', video: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
  { id: 3, title: 'Future Aesthetics', colorIdx: 3 },
  { id: 4, title: 'AI Exploration', colorIdx: 4 },
]

export default function ArtistProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { favorites, toggleFavorite, startConversation } = useApp()
  const { profile } = useAuth()
  const [showCalendar, setShowCalendar] = useState(false)
  const [activeTab, setActiveTab] = useState('portfolio')
  const { artist, loading: artistLoading } = useArtist(id)
  const reviewState = useArtistReviews(id, artist)

  const isOwnProfile = isArtistProfile(profile) && String(demoArtistPersona(profile)?.id) === String(id)
  const isHirer = profile && !isArtistProfile(profile)

  const [portfolioItems, setPortfolioItems] = useState(() => {
    try {
      const saved = localStorage.getItem(`su_portfolio_order_${id}`)
      if (saved) {
        const order = JSON.parse(saved)
        return [...DEFAULT_PORTFOLIO].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      }
    } catch {}
    return DEFAULT_PORTFOLIO
  })
  const [videoLinks, setVideoLinks] = useState([])

  useEffect(() => {
    if (artist?.videoLinks) setVideoLinks(artist.videoLinks)
  }, [artist?.videoLinks])

  useEffect(() => {
    if (portfolioItems.length > 0) {
      localStorage.setItem(`su_portfolio_order_${id}`, JSON.stringify(portfolioItems.map(p => p.id)))
    }
  }, [portfolioItems, id])

  const moveItem = (list, setList, index, direction) => {
    const newList = [...list]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newList.length) return
    const temp = newList[index]
    newList[index] = newList[targetIndex]
    newList[targetIndex] = temp
    setList(newList)
  }

  if (artistLoading) return <div className="page-container" style={{ paddingTop: 80, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
  if (!artist) return <div className="page-container"><p>Artist not found.</p></div>

  const {
    settings: reviewSettings,
    allReviews,
    publicReviews,
    publicAverage,
    updateShowOnProfile,
    updateReviewVisibility,
    submitReview,
    getVisibility,
    hirerExistingReview,
  } = reviewState

  const isFav = favorites.includes(artist.id)
  const hirerReview = isHirer ? hirerExistingReview(profile.id) : null
  const reviewsForDisplay = isOwnProfile ? allReviews : publicReviews
  const showRatingToHirer = isHirer && reviewSettings.showReviewsOnProfile && publicReviews.length > 0
  const heroRating = showRatingToHirer || isOwnProfile
    ? (publicAverage ?? artist.rating)
    : null
  const heroReviewCount = isOwnProfile ? publicReviews.length : publicReviews.length

  return (
    <div className="page-container">
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="profile-hero slide-up">
        <div className="profile-hero-content">
          <div className="avatar avatar-lg">{artist.avatar}</div>
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
            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 14, color: 'var(--text-muted)', maxWidth: '52ch', lineHeight: 1.5 }}>
              Compensation is not listed publicly — scope and fees are negotiated with the client for each engagement.
            </p>
            <div className="profile-socials">
              <a href={artist.socials.twitter} className="social-btn" title="Twitter"><AtSign size={16} /></a>
              <a href={artist.socials.instagram} className="social-btn" title="Instagram"><Camera size={16} /></a>
              <a href={artist.socials.linkedin} className="social-btn" title="LinkedIn"><Briefcase size={16} /></a>
              <a href={artist.socials.website} className="social-btn" title="Website"><Globe size={16} /></a>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'flex-start' }}>
            <button className="btn btn-primary btn-lg" onClick={() => startConversation(artist)}>
              <Send size={16} /> Hire / Inquire
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCalendar(true)}>
              <Calendar size={16} /> View Calendar
            </button>
            <button className="btn btn-ghost" onClick={() => toggleFavorite(artist.id)}
              style={isFav ? { color: 'var(--danger)' } : {}}>
              <Heart size={16} fill={isFav ? 'var(--danger)' : 'none'} />
              {isFav ? 'Favorited' : 'Add to Favorites'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {portfolioItems.map((item, i) => (
                  <div key={item.id} className="card" style={{
                    height: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
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
                        zIndex: 1
                      }}>
                        {item.title}
                      </div>
                    )}
                    
                    {isOwnProfile && (
                      <div style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        background: 'rgba(0,0,0,0.5)',
                        padding: 4,
                        borderRadius: 8,
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <button 
                          onClick={() => moveItem(portfolioItems, setPortfolioItems, i, -1)} 
                          disabled={i === 0}
                          style={{ background: 'none', border: 'none', color: i === 0 ? 'rgba(255,255,255,0.2)' : 'white', cursor: i === 0 ? 'default' : 'pointer', padding: 2 }}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button 
                          onClick={() => moveItem(portfolioItems, setPortfolioItems, i, 1)} 
                          disabled={i === portfolioItems.length - 1}
                          style={{ background: 'none', border: 'none', color: i === portfolioItems.length - 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: i === portfolioItems.length - 1 ? 'default' : 'pointer', padding: 2 }}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {videoLinks.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ marginBottom: 16 }}>Video Reels</h3>
                  {videoLinks.map((v, i) => (
                    <div key={i} style={{ marginBottom: 24, position: 'relative' }}>
                      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <VideoPlayer url={v} />
                        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Play size={16} style={{ color: 'var(--accent)' }} />
                            <span style={{ fontWeight: 500, fontSize: 14 }}>Video Reel {i + 1}</span>
                          </div>
                          
                          {isOwnProfile && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button 
                                className="btn btn-ghost btn-sm" 
                                style={{ padding: '4px 8px' }}
                                onClick={() => moveItem(videoLinks, setVideoLinks, i, -1)}
                                disabled={i === 0}
                              >
                                <ChevronUp size={16} />
                              </button>
                              <button 
                                className="btn btn-ghost btn-sm" 
                                style={{ padding: '4px 8px' }}
                                onClick={() => moveItem(videoLinks, setVideoLinks, i, 1)}
                                disabled={i === videoLinks.length - 1}
                              >
                                <ChevronDown size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isOwnProfile && (
                <ArtistReviewSettings
                  showReviewsOnProfile={reviewSettings.showReviewsOnProfile}
                  onShowReviewsOnProfileChange={updateShowOnProfile}
                  reviews={allReviews}
                  getVisibility={getVisibility}
                  onReviewVisibilityChange={updateReviewVisibility}
                />
              )}

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
                emptyMessage={
                  isOwnProfile
                    ? 'No reviews yet. When hirers leave feedback, you can choose what appears on your public profile.'
                    : reviewSettings.showReviewsOnProfile
                      ? 'No public reviews yet. Be the first to share feedback after working together.'
                      : 'This artist has chosen not to display reviews on their public profile.'
                }
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Brands & Clients</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {artist.brands.map(b => (
                <div key={b} style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                  border: '1px solid var(--border)', fontSize: 13, fontWeight: 500
                }}>{b}</div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Quick Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Projects</span>
                <span style={{ fontWeight: 600 }}>{artist.projects}</span>
              </div>
              {(showRatingToHirer || (isOwnProfile && publicReviews.length > 0)) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Public rating</span>
                  <span style={{ fontWeight: 600, color: 'var(--gold)' }}>
                    {publicAverage ?? artist.rating} ★
                  </span>
                </div>
              )}
              {isOwnProfile && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Total feedback</span>
                  <span style={{ fontWeight: 600 }}>{allReviews.length}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Compensation</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', fontSize: 13, maxWidth: '62%', lineHeight: 1.45 }}>
                  Agreed per project with the client (not shown on profile).
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Member Since</span>
                <span style={{ fontWeight: 600 }}>{new Date(artist.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCalendar && <CalendarModal artist={artist} onClose={() => setShowCalendar(false)} />}
    </div>
  )
}
