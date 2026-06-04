import { useState } from 'react'
import { Send } from './icons'
import StarRatingInput from './StarRatingInput'

export default function HirerReviewForm({ existingReview, hirerName, onSubmit }) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0)
  const [company, setCompany] = useState(existingReview?.company ?? '')
  const [text, setText] = useState(existingReview?.text ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (rating < 1) {
      setError('Please select a star rating.')
      return
    }
    if (text.trim().length < 20) {
      setError('Please write at least 20 characters about your experience.')
      return
    }
    onSubmit({ rating, company: company.trim(), text: text.trim() })
    setSaved(true)
  }

  return (
    <form className="card hirer-review-form slide-up" onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: 4, fontSize: 16 }}>
        {existingReview ? 'Update your review' : 'Share your experience'}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        {existingReview
          ? 'You can edit feedback you left after a completed engagement. The artist chooses which reviews appear on their public profile.'
          : 'Help other hirers by leaving honest feedback after working with this artist.'}
      </p>

      <div className="form-group">
        <label className="form-label">Overall rating</label>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="review-company">Company / team (optional)</label>
        <input
          id="review-company"
          className="form-input"
          placeholder="e.g. Nike Creative"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="review-text">Your feedback</label>
        <textarea
          id="review-text"
          className="form-input"
          rows={4}
          placeholder="What went well? What should future clients know?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </div>

      {error && <p className="hirer-review-form__error">{error}</p>}
      {saved && !error && (
        <p className="hirer-review-form__success">Thank you — your review has been saved.</p>
      )}

      <button type="submit" className="btn btn-primary" disabled={rating < 1}>
        <Send size={16} />
        {existingReview ? 'Update review' : 'Submit review'}
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, marginBottom: 0 }}>
        Posting as {hirerName}
      </p>
    </form>
  )
}
