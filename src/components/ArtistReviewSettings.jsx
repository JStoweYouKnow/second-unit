import { Eye, EyeOff } from './icons'

export default function ArtistReviewSettings({
  showReviewsOnProfile,
  onShowReviewsOnProfileChange,
  reviews,
  getVisibility,
  onReviewVisibilityChange,
}) {
  const visibleCount = reviews.filter((r) => getVisibility(r.id)).length

  return (
    <div className="card artist-review-settings slide-up">
      <h3 style={{ marginBottom: 8, fontSize: 16 }}>Public review visibility</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Hirers can leave feedback after engagements. You control whether reviews appear on your profile
        for clients browsing Artist Spotlight.
      </p>

      <label className="review-visibility-toggle">
        <input
          type="checkbox"
          checked={showReviewsOnProfile}
          onChange={(e) => onShowReviewsOnProfileChange(e.target.checked)}
        />
        <span>
          <strong>Show reviews on my public profile</strong>
          <small>
            {showReviewsOnProfile
              ? `${visibleCount} of ${reviews.length} review${reviews.length === 1 ? '' : 's'} visible when enabled below`
              : 'Your profile hides all reviews from hirers (you still see them here)'}
          </small>
        </span>
      </label>

      {showReviewsOnProfile && reviews.length > 0 && (
        <div className="artist-review-settings__list">
          <div className="artist-review-settings__list-head">
            <span>Individual reviews</span>
            <span>On public profile</span>
          </div>
          {reviews.map((r) => {
            const visible = getVisibility(r.id)
            return (
              <div key={r.id} className="artist-review-settings__row">
                <div className="artist-review-settings__row-meta">
                  <span className="artist-review-settings__row-name">{r.name}</span>
                  {r.company && (
                    <span className="artist-review-settings__row-co">{r.company}</span>
                  )}
                  <span className="artist-review-settings__row-rating">{r.rating} ★</span>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm ${visible ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => onReviewVisibilityChange(r.id, !visible)}
                  aria-pressed={visible}
                >
                  {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  {visible ? 'Visible' : 'Hidden'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
