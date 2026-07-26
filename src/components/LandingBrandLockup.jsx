import { useTheme } from '../context/ThemeContext'

const LANDING_LOCKUP_LIGHT = '/brand/landing-lockup-light.png'
const LANDING_LOCKUP_DARK = '/brand/landing-lockup-dark.png'

/** Full landing hero lockup — theme-aware minimal wordmark + tagline artwork. */
export default function LandingBrandLockup({ className = '' }) {
  const { isDark } = useTheme()

  return (
    <img
      src={isDark ? LANDING_LOCKUP_DARK : LANDING_LOCKUP_LIGHT}
      alt="The Callsheet — A curated network for vetted AI production talent"
      className={['landing-brand-lockup', className].filter(Boolean).join(' ')}
      decoding="async"
      draggable={false}
    />
  )
}
