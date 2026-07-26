import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Star, Play, CheckCircle } from '../components/icons'
import ThemeToggle from '../components/ThemeToggle'
import BrandLogo from '../components/BrandLogo'
import LandingBrandLockup from '../components/LandingBrandLockup'
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
          <BrandLogo variant="landing" />
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
            className={`landing-nav-link ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About Us
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
            <div className="landing-hero__inner">
              <LandingBrandLockup className="landing-hero__lockup hero-animate hero-animate--1" />
              <div className="landing-eyebrow hero-animate hero-animate--2">
                <Star size={14} /> Now in Private Beta
              </div>
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
                onClick={() => setActiveTab('about')}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                About Us <ArrowRight size={18} />
              </button>
            </div>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="landing-about landing-tab-content" key="about">
            <h2 className="landing-section-title reveal-stagger reveal-stagger--1">About The Callsheet</h2>
            <div className="landing-about__body">
              <article className="landing-about__block reveal-stagger reveal-stagger--1">
                <h3>What we&apos;re building</h3>
                <p>
                  The Callsheet is a marketplace for AI-native creatives and the teams that hire them.
                  We bring discovery, availability, messaging, bookings, agreements, milestone payments,
                  and dispute tools into one place so production work can move with less friction.
                </p>
              </article>
              <article className="landing-about__block reveal-stagger reveal-stagger--2">
                <h3>Who it&apos;s for</h3>
                <p>
                  <strong>Artists</strong> publish profiles, set rates and availability, accept bookings,
                  and get paid through Stripe Connect after work is approved.
                </p>
                <p>
                  <strong>Hirers</strong> find talent, book time or project blocks, fund milestones in
                  platform escrow, review deliverables, and release payment when ready.
                </p>
              </article>
              <article className="landing-about__block reveal-stagger reveal-stagger--3">
                <h3>How we think about trust</h3>
                <p>
                  Payments are processed by Stripe. Funds for milestones and bookings are held by the
                  platform until the hirer approves release. Artists complete Connect onboarding before
                  payouts can land. Disputes can be opened on-platform when something goes wrong.
                </p>
              </article>
            </div>
            <div className="landing-about__cta reveal-stagger reveal-stagger--3">
              <p>We&apos;re in private beta — features ship quickly and early users shape what we build next.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Join Beta <ArrowRight size={18} />
                </Link>
                <a href="mailto:support@thecallsheet.ai" className="btn btn-secondary btn-lg">
                  Contact Us
                </a>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="landing-footer">
        <div>&copy; 2026 The Callsheet. All rights reserved.</div>
        <div className="landing-footer__links">
          <Link to="/about">About</Link>
          <Link to="/help">Help</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <a href="mailto:support@thecallsheet.ai">Contact</a>
        </div>
      </footer>
    </div>
  )
}
