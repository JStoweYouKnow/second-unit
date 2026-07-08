import { CheckCircle, Shield } from './icons'
import { brandName, brandVerified } from '../lib/brands'

export default function BrandChip({ brand, onVerify, verifyBusy = false }) {
  const name = brandName(brand)
  const verified = brandVerified(brand)

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)',
        border: `1px solid ${verified ? 'rgba(52, 211, 153, 0.35)' : 'var(--border)'}`,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {verified && (
        <CheckCircle size={14} color="var(--success)" aria-hidden />
      )}
      <span>{name}</span>
      {verified && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--success)' }}>
          Verified
        </span>
      )}
      {onVerify && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 4, padding: '2px 8px', minHeight: 0, fontSize: 11 }}
          disabled={verifyBusy}
          title={verified ? 'Remove verification' : 'Mark as verified client'}
          onClick={() => onVerify(name, !verified)}
        >
          <Shield size={12} />
          {verified ? 'Unverify' : 'Verify'}
        </button>
      )}
    </div>
  )
}
