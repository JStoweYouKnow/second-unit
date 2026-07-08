import { normalizeArtistPricing } from '../lib/pricing'

/**
 * Hourly / daily / flat rate card for discovery and profile surfaces.
 */
export default function ArtistRateCard({ artist, compact = false, className = '' }) {
  const p = normalizeArtistPricing(artist)
  const hasHourly = p.hourlyRate > 0
  const hasDaily = artist.dailyRate != null && Number(artist.dailyRate) > 0
  const hasFlat = artist.projectFlatRate != null && Number(artist.projectFlatRate) > 0

  if (!hasHourly && !hasDaily && !hasFlat) return null

  if (compact) {
    const primary = hasHourly
      ? `$${p.hourlyRate}/hr`
      : hasDaily
        ? `$${p.dailyRate.toLocaleString()}/day`
        : `$${p.projectFlatRate.toLocaleString()} flat`
    return (
      <span className={`artist-rate-card artist-rate-card--compact ${className}`.trim()} style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 700 }}>
        {primary}
      </span>
    )
  }

  return (
    <div
      className={`artist-rate-card ${className}`.trim()}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))',
        gap: 10,
        marginTop: hasHourly || hasDaily || hasFlat ? 12 : 0,
      }}
    >
      {hasHourly && (
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>${p.hourlyRate}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>per hour</div>
        </div>
      )}
      {(hasDaily || (!hasFlat && p.dailyRate > 0)) && (
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>${p.dailyRate.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>per day</div>
        </div>
      )}
      {(hasFlat || p.projectFlatRate > 0) && (
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>${p.projectFlatRate.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>flat project</div>
        </div>
      )}
    </div>
  )
}
