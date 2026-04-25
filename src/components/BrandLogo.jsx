/**
 * Second Unit brand lockup (public/brand/second-unit-logo.png).
 * Parent should set aria-label on the interactive wrapper (e.g. home button).
 */
export default function BrandLogo({ variant = 'sidebar' }) {
  const isCompact = variant === 'compact' || variant === 'mobile'
  return (
    <img
      src="/brand/second-unit-logo.png"
      alt=""
      className={`brand-logo${isCompact ? ' brand-logo--compact' : ''}`}
      decoding="async"
    />
  )
}
