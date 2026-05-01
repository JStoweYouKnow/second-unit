import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Star, Play, CheckCircle } from '../components/icons'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  return (
    <div className="landing-page" style={{ background: 'var(--bg-app)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {/* Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px', borderBottom: '1px solid var(--border)', background: 'rgba(5, 5, 5, 0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <BrandLogo />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link to="/signin" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'var(--transition)' }} onMouseEnter={e => e.target.style.color = 'var(--text-primary)'} onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}>
            Sign In
          </Link>
          <Link to="/signup" className="btn btn-primary" style={{ padding: '8px 24px', borderRadius: 24 }}>
            Join Beta
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '120px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Cinematic glow effect */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(245, 197, 66, 0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
        
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(245, 197, 66, 0.1)', border: '1px solid rgba(245, 197, 66, 0.2)', borderRadius: 30, color: 'var(--gold)', fontSize: 14, fontWeight: 600, marginBottom: 32 }}>
            <Star size={14} fill="var(--gold)" /> Now in Private Beta
          </div>
          <h1 style={{ fontSize: 'clamp(48px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24 }}>
            The Premier Marketplace for <span style={{ color: 'var(--gold)' }}>AI Native Creatives</span>
          </h1>
          <p style={{ fontSize: 'clamp(18px, 2vw, 22px)', color: 'var(--text-secondary)', maxWidth: 700, margin: '0 auto 48px auto', lineHeight: 1.6 }}>
            Connect with elite AI visual artists, motion designers, and virtual production specialists for your next studio campaign.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" className="btn btn-primary btn-lg" style={{ padding: '16px 32px', fontSize: 16, borderRadius: 30 }}>
              Hire Talent <ArrowRight size={18} />
            </Link>
            <Link to="/signup" className="btn btn-secondary btn-lg" style={{ padding: '16px 32px', fontSize: 16, borderRadius: 30, background: 'transparent', borderColor: 'var(--border)' }}>
              Apply as Artist
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, marginBottom: 64 }}>Why Top Studios Choose Second Unit</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
          
          <div className="card" style={{ padding: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 197, 66, 0.1)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Star size={24} />
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>Vetted Elite Talent</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>We rigorously screen every artist. Only the top 1% of AI creative professionals make it onto our invite-only platform.</p>
          </div>

          <div className="card" style={{ padding: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 197, 66, 0.1)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Play size={24} />
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>Cinematic Showcases</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Review portfolios via high-fidelity, instant-playback native HTML5 video showcases before initiating a contract.</p>
          </div>

          <div className="card" style={{ padding: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 197, 66, 0.1)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <CheckCircle size={24} />
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>Secure Contracts & Escrow</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Seamlessly handle legal agreements, milestone tracking, and secure payments via Stripe all in one thread.</p>
          </div>

        </div>
      </section>

      {/* Footer CTA */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 40, marginBottom: 24 }}>Ready to redefine production?</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Join the private beta today and access the future of creative talent.</p>
        <Link to="/signup" className="btn btn-primary btn-lg" style={{ padding: '16px 40px', fontSize: 18, borderRadius: 30 }}>
          Get Started
        </Link>
      </section>
      
      {/* Simple Footer */}
      <footer style={{ padding: '40px 48px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        <div>&copy; 2026 Second Unit. All rights reserved.</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms</a>
          <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy</a>
          <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>
    </div>
  )
}
