/**
 * The Callsheet brand lockup (public/brand/the-callsheet-logo.png).
 * Parent should set aria-label on the interactive wrapper (e.g. home button).
 */
export default function BrandLogo({ variant = 'sidebar' }) {
  const isCompact = variant === 'compact' || variant === 'mobile'
  return (
    <img
      src="/brand/the-callsheet-logo.png"
      alt=""
      className={`brand-logo${isCompact ? ' brand-logo--compact' : ''}`}
      decoding="async"
    />
  )
}
