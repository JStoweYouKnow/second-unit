import { useNavigate } from 'react-router-dom'
import { FileQuestion, ArrowLeft, LayoutDashboard } from '../components/icons'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="page-container" style={{
      minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', paddingTop: 24, paddingBottom: 48,
    }}>
      <div style={{
        padding: 24, borderRadius: '50%', background: 'var(--surface)',
        marginBottom: 24, color: 'var(--accent)', border: '1px solid var(--border)',
      }}>
        <FileQuestion size={64} aria-hidden />
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 6vw, 40px)', marginBottom: 12, lineHeight: 1.15 }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28, maxWidth: 420, lineHeight: 1.55, fontSize: 15 }}>
        {"That URL doesn't match anything here. If you followed a link, it may be out of date — try Spotlight or your dashboard."}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/')}>
          <ArrowLeft size={18} aria-hidden /> Artist Spotlight
        </button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/dashboard')}>
          <LayoutDashboard size={18} aria-hidden /> Dashboard
        </button>
      </div>
    </div>
  )
}
