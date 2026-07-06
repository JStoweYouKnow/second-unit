import { useTheme } from '../context/ThemeContext'

const LOGO_SRC = '/brand/the-callsheet-transparent-logo.png'

/**
 * The Callsheet brand lockup — transparent PNG (white mark + wordmark).
 * Inverted on light UI; native white on dark surfaces and the brand bar.
 *
 * variant: sidebar | compact | landing | auth
 */
export default function BrandLogo({ variant = 'sidebar', onDark }) {
  const { isDark } = useTheme()
  const useOnDark = onDark ?? isDark

  return (
    <img
      src={LOGO_SRC}
      alt="The Callsheet"
      className={[
        'brand-logo',
        variant === 'compact' ? 'brand-logo--compact' : '',
        variant === 'landing' ? 'brand-logo--landing' : '',
        variant === 'auth' ? 'brand-logo--auth' : '',
        useOnDark ? 'brand-logo--on-dark' : '',
      ].filter(Boolean).join(' ')}
      decoding="async"
    />
  )
}
