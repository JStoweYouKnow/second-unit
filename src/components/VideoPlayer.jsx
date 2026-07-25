import { useState } from 'react'
import { Play } from './icons'
import {
  getVideoEmbedUrl,
  resolveVideoPoster,
} from '../lib/videoReels'

/**
 * Click-to-play facade: custom/default poster until the user starts playback,
 * then the YouTube/Vimeo iframe (or native video) loads.
 */
export default function VideoPlayer({ url, thumbnail, title, autoPlayOnClick = true }) {
  const [playing, setPlaying] = useState(false)
  const embedUrl = getVideoEmbedUrl(url, { autoplay: autoPlayOnClick })
  const poster = resolveVideoPoster(url, thumbnail)
  const label = title || 'Play video'

  if (!url) return null

  if (playing && embedUrl) {
    return (
      <div className="video-player video-player--active">
        <iframe
          src={embedUrl}
          title={label}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      </div>
    )
  }

  if (playing && !embedUrl) {
    return (
      <div className="video-player video-player--active">
        <video
          controls
          autoPlay
          playsInline
          poster={poster || undefined}
          style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
        >
          <source src={url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="video-player video-player--facade"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${label}`}
    >
      {poster ? (
        <img
          className="video-player__poster"
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="video-player__poster video-player__poster--empty" aria-hidden />
      )}
      <span className="video-player__play" aria-hidden>
        <Play size={28} />
      </span>
    </button>
  )
}
