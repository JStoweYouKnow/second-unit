import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Star, Play, CheckCircle } from '../components/icons'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')

  const isGuestMode = new URLSearchParams(window.location.search).get('guest') === 'true'

  if (isAuthenticated && !isGuestMode) {
    return <Navigate to="/home" replace />
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="logo-home">
          <img
            src="/brand/the-callsheet-transparent-logo.png"
            alt="The Callsheet"
            className="brand-logo brand-logo--landing brand-logo--on-dark"
            decoding="async"
          />
        </div>
        <nav className="landing-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={`landing-nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`landing-nav-link ${activeTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            Features
          </button>
          <button
            type="button"
            className={`landing-nav-link ${activeTab === 'beta' ? 'active' : ''}`}
            onClick={() => setActiveTab('beta')}
          >
            Private Beta
          </button>
        </nav>
        <div className="landing-header__actions">
          <ThemeToggle variant="compact" />
          <Link to="/signin" className="landing-header__link">Sign In</Link>
          <Link to="/signup" className="btn btn-primary btn-sm">Join Beta</Link>
        </div>
      </header>

      <main className="landing-content">
        {activeTab === 'overview' && (
          <section className="landing-hero landing-tab-content" key="overview">
            <video
              className="landing-hero__video"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            >
              <source src="/videos/hero-bg.mp4" type="video/mp4" />
            </video>
            <div className="landing-hero__video-overlay" />
            <div className="landing-hero__inner">
              <div className="landing-eyebrow hero-animate hero-animate--1">
                <Star size={14} /> Now in Private Beta
              </div>
              <h1 className="landing-hero__title hero-animate hero-animate--2">
                The premier marketplace for{' '}
                <span className="landing-hero__emphasis">AI native creatives</span>
              </h1>
              <p className="landing-hero__lede hero-animate hero-animate--3">
                Connect with elite AI visual artists, motion designers, and virtual production
                specialists for your next studio campaign.
              </p>
              <div className="landing-hero__cta hero-animate hero-animate--4">
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Hire Talent <ArrowRight size={18} />
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab('features')}
                  className="btn btn-secondary btn-lg"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  Learn More <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'features' && (
          <section className="landing-features landing-tab-content" key="features">
            <h2 className="landing-section-title reveal-stagger reveal-stagger--1">Why top studios choose The Callsheet</h2>
            <div className="landing-features__grid">
              <article className="card landing-feature-card reveal-stagger reveal-stagger--1">
                <div className="landing-feature-card__icon"><Star size={22} /></div>
                <h3>Vetted elite talent</h3>
                <p>
                  We rigorously screen every artist. Only the top 1% of AI creative professionals
                  make it onto our invite-only platform.
                </p>
              </article>
              <article className="card landing-feature-card reveal-stagger reveal-stagger--2">
                <div className="landing-feature-card__icon"><Play size={22} /></div>
                <h3>Cinematic showcases</h3>
                <p>
                  Review portfolios via high-fidelity, instant-playback native HTML5 video showcases
                  before initiating a contract.
                </p>
              </article>
              <article className="card landing-feature-card reveal-stagger reveal-stagger--3">
                <div className="landing-feature-card__icon"><CheckCircle size={22} /></div>
                <h3>Secure contracts &amp; escrow</h3>
                <p>
                  Seamlessly handle legal agreements, milestone tracking, and secure payments via
                  Stripe — all in one thread.
                </p>
              </article>
            </div>
            <div className="reveal-stagger reveal-stagger--3" style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <button
                type="button"
                onClick={() => setActiveTab('beta')}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                Join Private Beta <ArrowRight size={18} />
              </button>
            </div>
          </section>
        )}

        {activeTab === 'beta' && (
          <div className="landing-cta-container landing-tab-content" key="beta">
            <section className="landing-cta-band">
              <h2>Ready to redefine production?</h2>
              <p>Join the private beta today and access the future of creative talent.</p>
              <Link to="/signup" className="btn btn-inverse btn-lg">Get Started</Link>
            </section>

            <footer className="landing-footer">
              <div>&copy; 2026 The Callsheet. All rights reserved.</div>
              <div className="landing-footer__links">
                <Link to="/terms">Terms</Link>
                <Link to="/privacy">Privacy</Link>
                <a href="mailto:support@thecallsheet.ai">Contact</a>
              </div>
            </footer>
          </div>
        )}
      </main>
    </div>
  )
}
