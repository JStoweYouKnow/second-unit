import { useState, useCallback } from 'react'
import { Star } from './icons'

function formatReviewDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function ReviewReplyForm({ reviewId, initialText, onSubmit }) {
  const [text, setText] = useState(initialText || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Write a reply before saving.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(reviewId, trimmed)
    } catch (err) {
      setError(err.message || 'Could not save reply')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="review-response-form" onSubmit={handleSubmit}>
      <label className="review-response-form__label" htmlFor={`reply-${reviewId}`}>
        Your reply
      </label>
      <textarea
        id={`reply-${reviewId}`}
        className="review-response-form__input"
        rows={3}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Thank the client and address their feedback…"
      />
      {error && <p className="review-response-form__error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
        {saving ? 'Saving…' : initialText ? 'Update reply' : 'Post reply'}
      </button>
    </form>
  )
}

export default function ReviewList({ reviews, emptyMessage, isOwnProfile = false, onReply }) {
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
          {r.artistResponse && (
            <div className="review-card__response">
              <span className="review-card__response-label">Artist response</span>
              <p className="review-card__response-body">{r.artistResponse}</p>
              {r.artistResponseAt && (
                <span className="review-card__response-date">{formatReviewDate(r.artistResponseAt)}</span>
              )}
            </div>
          )}
          {isOwnProfile && onReply && (
            <ReviewReplyForm
              reviewId={r.id}
              initialText={r.artistResponse}
              onSubmit={onReply}
            />
          )}
          {r.source === 'hirer' && (
            <span className="review-card__badge">Verified hirer feedback</span>
          )}
        </article>
      ))}
    </div>
  )
}
