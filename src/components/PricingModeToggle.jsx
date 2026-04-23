import { useApp } from '../context/AppContext'

const MODES = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'flat', label: 'Flat' },
]

/**
 * @param {{ compact?: boolean, className?: string }} props
 */
export default function PricingModeToggle({ compact = false, className = '' }) {
  const { pricingMode, setPricingMode } = useApp()

  return (
    <div
      className={`pricing-mode-toggle ${compact ? 'pricing-mode-toggle--compact' : ''} ${className}`.trim()}
      role="group"
      aria-label="Project pricing basis"
    >
      <span className="pricing-mode-toggle-label">Pricing</span>
      <div className="pricing-mode-toggle-buttons">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={pricingMode === id ? 'active' : ''}
            onClick={() => setPricingMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
