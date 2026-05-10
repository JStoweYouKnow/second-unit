import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'

export default function Terms() {
  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', paddingTop: 64, paddingBottom: 64 }}>
      <div style={{ marginBottom: 48 }}>
        <BrandLogo />
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Last updated: May 2026</p>
      
      <div style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>1. Acceptance of Terms</h2>
        <p style={{ marginBottom: 16 }}>By accessing and using Second Unit, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.</p>
        
        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>2. Description of Service</h2>
        <p style={{ marginBottom: 16 }}>Second Unit provides a marketplace platform connecting AI artists and creative professionals with employers and studios for project-based work.</p>
        
        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>3. User Accounts</h2>
        <p style={{ marginBottom: 16 }}>You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password. You agree not to disclose your password to any third party.</p>
      </div>

      <div style={{ marginTop: 64 }}>
        <Link to="/" className="btn btn-secondary">Return Home</Link>
      </div>
    </div>
  )
}
