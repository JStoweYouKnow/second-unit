import { useTheme } from '../context/ThemeContext'

/**
 * The Callsheet brand lockup — a theme-colored vector wordmark.
 *
 * Rendered as live text (not a raster) using `currentColor`, so it is dark on
 * light UI and light on dark UI automatically — matching the light/dark logo
 * artwork. On an intentionally dark surface regardless of theme, pass onDark.
 *
 * variant: sidebar | compact | landing | auth
 */
export default function BrandLogo({ variant = 'sidebar', onDark }) {
  const { isDark } = useTheme()
  const useOnDark = onDark ?? isDark

  return (
    <span
      role="img"
      aria-label="The Callsheet AI"
      className={[
        'brand-logo',
        `brand-logo--${variant}`,
        useOnDark ? 'brand-logo--on-dark' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="brand-logo__word" aria-hidden="true">The Callsheet</span>
      <span className="brand-logo__ai" aria-hidden="true">AI</span>
    </span>
  )
}
