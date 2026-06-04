import { Star } from './icons'

function formatReviewDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function ReviewList({ reviews, emptyMessage }) {
  if (!reviews.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="review-list slide-up">
      {reviews.map((r) => (
        <article key={r.id} className="card review-card">
          <div className="review-card__head">
            <div>
              <span className="review-card__name">{r.name}</span>
              {r.company && <span className="review-card__company">{r.company}</span>}
              {r.createdAt && (
                <span className="review-card__date">{formatReviewDate(r.createdAt)}</span>
              )}
            </div>
            <div className="review-card__stars" aria-label={`${r.rating} out of 5 stars`}>
              {Array.from({ length: r.rating }, (_, j) => (
                <Star key={j} size={14} fill="var(--gold)" color="var(--gold)" />
              ))}
            </div>
          </div>
          <p className="review-card__body">{r.text}</p>
          {r.source === 'hirer' && (
            <span className="review-card__badge">Verified hirer feedback</span>
          )}
        </article>
      ))}
    </div>
  )
}
