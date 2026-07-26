import { useTheme } from '../context/ThemeContext'

/** Black wordmark — shown on light UI surfaces. */
const LOGO_LIGHT_MODE = '/brand/the-callsheet-wordmark-light.png'
/** White wordmark — shown on dark UI surfaces. */
const LOGO_DARK_MODE = '/brand/the-callsheet-wordmark-dark.png'

/**
 * The Callsheet brand lockup — theme-aware PNG wordmark.
 *
 * Uses the black artwork in light mode and the white artwork in dark mode.
 * Pass onDark when the logo sits on an intentionally dark surface regardless
 * of theme (e.g. the landing page header bar).
 *
 * variant: sidebar | compact | landing | auth
 */
export default function BrandLogo({ variant = 'sidebar', onDark, className = '' }) {
  const { isDark } = useTheme()
  const useDarkLogo = onDark ?? isDark

  return (
    <img
      src={useDarkLogo ? LOGO_DARK_MODE : LOGO_LIGHT_MODE}
      alt="The Callsheet AI"
      className={[
        'brand-logo-img',
        `brand-logo-img--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      decoding="async"
      draggable={false}
    />
  )
}
