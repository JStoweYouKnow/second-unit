import { useNavigate } from 'react-router-dom'
import { FileQuestion, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="page-container" style={{
      height: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center'
    }}>
      <div style={{
        padding: 24, borderRadius: '50%', background: 'var(--surface)',
        marginBottom: 24, color: 'var(--accent)'
      }}>
        <FileQuestion size={64} />
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, marginBottom: 16 }}>404 — Lost in Space?</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 400 }}>
        The page you're looking for doesn't exist or has been moved. Let's get you back to the leaderboard.
      </p>
      <button className="btn btn-primary btn-lg" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Back to Leaderboard
      </button>
    </div>
  )
}
