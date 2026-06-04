import { Star } from './icons'

export default function StarRatingInput({ value, onChange, max = 5, size = 22 }) {
  return (
    <div className="star-rating-input" role="group" aria-label="Rating">
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1
        const filled = star <= value
        return (
          <button
            key={star}
            type="button"
            className={`star-rating-input__btn${filled ? ' star-rating-input__btn--on' : ''}`}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            aria-pressed={filled}
            onClick={() => onChange(star)}
          >
            <Star size={size} fill={filled ? 'var(--gold)' : 'none'} color="var(--gold)" />
          </button>
        )
      })}
    </div>
  )
}
