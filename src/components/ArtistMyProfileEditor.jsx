import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload, Loader2, Eye, EyeOff, ExternalLink, Calendar,
} from './icons'
import CalendarModal from './CalendarModal'
import { ArtistFormFields } from './ArtistFormFields'
import ArtistReviewSettings from './ArtistReviewSettings'
import { useArtist } from '../hooks/useData'
import { useArtistProfile, saveArtistProfile } from '../hooks/useArtistProfile'
import { useArtistReviews } from '../hooks/useArtistReviews'
import { useAuth } from '../context/AuthContext'
import { artistRecordToForm, emptyArtistForm, parseCommaList } from '../lib/artistProfile'
import { uploadHeaderImage } from '../lib/portfolioMedia'
import { resolveProfileHero } from '../lib/profileHero'
import { normalizeVideoReels } from '../lib/videoReels'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

function mapPortfolioRow(p) {
  const url = p.media_url || p.image || p.video
  const isVideo = p.media_type === 'video' || !!p.video
  return {
    id: p.id,
    title: p.title || 'Portfolio',
    image: isVideo ? null : url,
    video: isVideo ? url : null,
    colorIdx: p.colorIdx ?? 0,
  }
}

/**
 * Sidebar “My profile” — edit public layout, header, and listing.
 */
export default function ArtistMyProfileEditor({ artistId, onUpdated }) {
  const { profile } = useAuth()
  const { artist, loading } = useArtist(artistId)
  const { artist: artistRecord, refetch: refetchRecord } = useArtistProfile(profile?.id)
  const reviewState = useArtistReviews(artistId)

  const [form, setForm] = useState(emptyArtistForm())
  const [headerImageUrl, setHeaderImageUrl] = useState(null)
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)
  const [headerBusy, setHeaderBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const headerInputRef = useRef(null)

  useEffect(() => {
    if (artistRecord) setForm(artistRecordToForm(artistRecord))
  }, [artistRecord])

  useEffect(() => {
    setHeaderImageUrl(artist?.headerImageUrl ?? null)
    setIsPublic(artist?.isPublic !== false)
  }, [artist?.headerImageUrl, artist?.isPublic])

  const portfolioItems = useMemo(
    () => (artist?.portfolio?.length ? artist.portfolio.map(mapPortfolioRow) : []),
    [artist?.portfolio]
  )

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

  const videoLinks = normalizeVideoReels(form.videoLinks || artist?.videoLinks || [])
  const { heroImg, heroVideo } = resolveProfileHero({
    portfolioItems,
    videoLinks,
    headerImageUrl,
    getVideoThumb,
  })

  const patchArtist = async (fields) => {
    if (!artistId || !isSupabaseConfigured || !supabase) return
    const { error: err } = await supabase
      .from('artists')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', artistId)
    if (err) throw err
  }

  const handleTogglePublic = async () => {
    const next = !isPublic
    setIsPublic(next)
    setError('')
    try {
      await patchArtist({ is_public: next })
      setStatus(next ? 'Profile listed in Artist Database' : 'Profile hidden from database')
      onUpdated?.()
      setTimeout(() => setStatus(''), 2500)
    } catch (err) {
      setIsPublic(!next)
      setError(err.message || 'Could not update listing')
    }
  }

  const handleHeaderUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !artistId) return
    setHeaderBusy(true)
    setError('')
    try {
      const { mediaUrl } = await uploadHeaderImage(artistId, file)
      await patchArtist({
        header_image_url: mediaUrl,
        featured_portfolio_item_id: null,
        featured_video_link: null,
      })
      setHeaderImageUrl(mediaUrl)
      setStatus('Header image updated')
      onUpdated?.()
      setTimeout(() => setStatus(''), 2500)
    } catch (err) {
      setError(err.message || 'Header upload failed')
    } finally {
      setHeaderBusy(false)
    }
  }

  const clearHeaderImage = async () => {
    setHeaderBusy(true)
    setError('')
    try {
      await patchArtist({ header_image_url: null })
      setHeaderImageUrl(null)
      setStatus('Header cleared — auto layout will use portfolio')
      onUpdated?.()
      setTimeout(() => setStatus(''), 2500)
    } catch (err) {
      setError(err.message || 'Could not clear header')
    } finally {
      setHeaderBusy(false)
    }
  }

  const handleSaveDetails = async (e) => {
    e.preventDefault()
    if (!profile?.id) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const { error: saveError } = await saveArtistProfile({
        profileId: profile.id,
        fullName: form.fullName || profile.full_name || artist?.name || '',
        form,
        existingArtist: artistRecord,
      })
      if (saveError) throw saveError
      await refetchRecord?.()
      onUpdated?.()
      setStatus('Profile details saved')
      setTimeout(() => setStatus(''), 2500)
    } catch (err) {
      setError(err.message || 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !artist) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin" size={20} /> Loading profile…
      </div>
    )
  }

  if (!artist) {
    return <div className="card" style={{ padding: 24 }}>Artist profile not found.</div>
  }

  const {
    settings: reviewSettings,
    allReviews,
    updateShowOnProfile,
    updateReviewVisibility,
    getVisibility,
  } = reviewState

  return (
    <div className="artist-my-profile slide-up">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '0 0 6px' }}>My profile</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
            Edit how your public page looks. Hirers see this layout in the Artist Database.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${isPublic ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleTogglePublic}
            aria-pressed={isPublic}
          >
            {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
            {isPublic ? ' Listed in database' : ' Hidden from database'}
          </button>
          <Link to={`/artist/${artistId}?view=public`} className="btn btn-secondary btn-sm">
            <ExternalLink size={14} /> View public page
          </Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCalendar(true)}>
            <Calendar size={14} /> Edit Availability
          </button>
        </div>
      </div>

      {(error || status) && (
        <div className={error ? 'auth-error' : ''} style={{ marginBottom: 16, fontSize: 13, color: error ? undefined : 'var(--success)' }}>
          {error || status}
        </div>
      )}

      {/* Live preview */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          External preview
        </div>
        <div
          className={`profile-hero profile-hero--editor-preview${heroImg || heroVideo ? ' profile-hero--visual' : ''}`}
          style={heroImg && !heroVideo ? { backgroundImage: `url(${heroImg})` } : undefined}
        >
          {heroVideo && (
            <video className="profile-hero__bg-video" autoPlay muted loop playsInline>
              <source src={heroVideo} type="video/mp4" />
            </video>
          )}
          {(heroImg || heroVideo) && <div className="profile-hero__gradient" />}
          <div className="profile-hero-content">
            {!heroImg && !heroVideo && (
              <div className="avatar avatar-lg">{artist.avatar}</div>
            )}
            <div className="profile-details">
              <h1 style={{ fontSize: 28 }}>{form.fullName || artist.name}</h1>
              <div className="role">{form.roleTitle || artist.role}</div>
              {parseCommaList(form.skills).length > 0 && (
                <div className="artist-skills" style={{ marginTop: 12 }}>
                  {parseCommaList(form.skills).map((s) => (
                    <span key={s} className="skill-tag" style={{ fontSize: 12, padding: '4px 10px' }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header image */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Header image</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
          Upload a dedicated banner for your public profile. This replaces auto-picking from portfolio.
        </p>
        <input
          ref={headerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={handleHeaderUpload}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={headerBusy}
            onClick={() => headerInputRef.current?.click()}
          >
            {headerBusy ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            {headerBusy ? ' Uploading…' : headerImageUrl ? ' Replace header image' : ' Upload header image'}
          </button>
          {headerImageUrl && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={headerBusy} onClick={clearHeaderImage}>
              Clear header
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>JPG, PNG, WebP, GIF — max 50MB</span>
        </div>
        {headerImageUrl && (
          <div className="profile-header-image-preview" aria-label="Current header preview">
            <img src={headerImageUrl} alt="" />
          </div>
        )}
      </div>

      {/* Details */}
      <form className="card" style={{ padding: 24, marginBottom: 24 }} onSubmit={handleSaveDetails}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Profile details</h3>
        <ArtistFormFields form={form} onChange={setForm} />
        <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <><Loader2 className="animate-spin" size={14} /> Saving…</> : 'Save details'}
          </button>
        </div>
      </form>

      <ArtistReviewSettings
        showReviewsOnProfile={reviewSettings.showReviewsOnProfile}
        onShowReviewsOnProfileChange={updateShowOnProfile}
        reviews={allReviews}
        getVisibility={getVisibility}
        onReviewVisibilityChange={updateReviewVisibility}
      />

      {showCalendar && (
        <CalendarModal
          artist={artist}
          editable
          artistDbId={artistId}
          onAvailabilitySaved={() => onUpdated?.()}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  )
}
