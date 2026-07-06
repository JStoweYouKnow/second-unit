import { Moon, Sun } from './icons'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle({ variant = 'nav', className = '', showLabel = false }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Light mode' : 'Dark mode'

  if (variant === 'nav') {
    return (
      <button
        type="button"
        className={`nav-link theme-toggle theme-toggle--nav ${className}`.trim()}
        onClick={toggleTheme}
        aria-label={label}
        aria-pressed={isDark}
      >
        {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        {showLabel ? label : 'Appearance'}
      </button>
    )
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        className={`theme-toggle theme-toggle--compact ${className}`.trim()}
        onClick={toggleTheme}
        aria-label={label}
        aria-pressed={isDark}
      >
        {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--row ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
    >
      <span className="theme-toggle__copy">
        <span className="theme-toggle__title">{label}</span>
        <span className="theme-toggle__hint">
          {isDark ? 'Switch to the light editorial palette' : 'Switch to the dark studio palette'}
        </span>
      </span>
      <span className="theme-toggle__track" data-on={isDark}>
        <span className="theme-toggle__thumb" />
      </span>
    </button>
  )
}
