import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'

export default function Privacy() {
  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', paddingTop: 64, paddingBottom: 64 }}>
      <div style={{ marginBottom: 48 }}>
        <BrandLogo />
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Last updated: May 2026</p>
      
      <div style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>1. Information We Collect</h2>
        <p style={{ marginBottom: 16 }}>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us.</p>
        
        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>2. How We Use Information</h2>
        <p style={{ marginBottom: 16 }}>We use the information we collect about you to provide, maintain, and improve our services, including facilitating payments, sending receipts, providing products and services you request, and sending related information.</p>
        
        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>3. Data Security</h2>
        <p style={{ marginBottom: 16 }}>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.</p>
      </div>

      <div style={{ marginTop: 64 }}>
        <Link to="/" className="btn btn-secondary">Return Home</Link>
      </div>
    </div>
  )
}
