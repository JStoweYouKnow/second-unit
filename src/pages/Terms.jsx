import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { PLATFORM_FEE_PERCENT } from '../lib/fees'

export default function Terms() {
  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', paddingTop: 64, paddingBottom: 64 }}>
      <div style={{ marginBottom: 48 }}>
        <BrandLogo />
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Last updated: July 2026</p>

      <div style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>1. Acceptance of Terms</h2>
        <p style={{ marginBottom: 16 }}>
          By accessing and using The Callsheet, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use our platform.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>2. Description of Service</h2>
        <p style={{ marginBottom: 16 }}>
          The Callsheet is a marketplace connecting AI artists and creative professionals with hirers (clients) for project-based work. The platform provides messaging, bookings, project agreements, milestone payments, optional deliverable submission, and dispute mediation tools.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>3. User Accounts</h2>
        <p style={{ marginBottom: 16 }}>
          You are responsible for safeguarding credentials used to access the service and for activity under your account. Artist participation may require an invite and application approval. Hirers may create accounts subject to our private beta access rules.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>4. Payments, Escrow, and Fees</h2>
        <p style={{ marginBottom: 16 }}>
          Hirers pay for bookings and milestones through Stripe Checkout. Funds are charged to the hirer and held by The Callsheet (platform escrow) until the hirer approves release of a milestone or completes a booking without milestones. Artists receive their share via Stripe Connect transfer after approval.
        </p>
        <p style={{ marginBottom: 16 }}>
          The Callsheet retains a platform fee of {PLATFORM_FEE_PERCENT}% of the funded amount. The artist payout is typically {100 - PLATFORM_FEE_PERCENT}% of the funded amount, subject to Stripe processing, applicable taxes, refunds, chargebacks, and dispute outcomes. Card and bank details are collected by Stripe; The Callsheet does not store full payment card numbers.
        </p>
        <p style={{ marginBottom: 16 }}>
          Artists must complete Stripe Connect onboarding with payouts enabled before transfers can succeed. Bank deposits follow Stripe’s payout schedule and are not instantaneous upon release.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>5. Approvals, Deliverables, and Release Requests</h2>
        <p style={{ marginBottom: 16 }}>
          Artists may optionally attach notes, links, or files to a milestone and may request release. A deliverable is not required for a release request. Hirers remain responsible for reviewing work and approving release. Approval triggers the artist payout transfer when Connect requirements are met.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>6. Agreements and Electronic Signatures</h2>
        <p style={{ marginBottom: 16 }}>
          Projects may use The Callsheet standard agreement, custom typed terms, and/or an uploaded PDF or Word attachment.
          Signing is a typed electronic signature (name + confirmation checkbox) that records timestamp, signer account,
          IP address when available, user agent, and a hash of the agreement content at sign time. This is intended to
          evidence intent under ESIGN/UETA-style frameworks; it is not third-party identity-proofed signing (e.g. DocuSign).
          Parties remain responsible for ensuring agreements meet their legal and tax needs. Hirers may store W-9 / 1099
          agreements in Account → Business &amp; tax; The Callsheet does not file taxes on your behalf.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>7. Disputes and Mediation</h2>
        <p style={{ marginBottom: 16 }}>
          Either party may open a dispute on the platform. The Callsheet may review evidence and record outcomes that include refunding the hirer, releasing funds to the artist, splitting amounts, or taking no payment action. Platform dispute tools do not replace any rights you may have under applicable law or with your payment provider. Chargebacks may reverse platform charges independently of dispute outcomes.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>8. Independent Contractor Relationship</h2>
        <p style={{ marginBottom: 16 }}>
          Artists and hirers engage each other as independent parties. Nothing in these Terms creates an employment, partnership, or joint venture relationship between users, or between a user and The Callsheet, except as required for payment processing.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>9. Acceptable Use</h2>
        <p style={{ marginBottom: 16 }}>
          You agree not to misuse the platform, upload unlawful content, circumvent payments, or attempt unauthorized access to accounts, APIs, or payment flows.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>10. Limitation of Liability</h2>
        <p style={{ marginBottom: 16 }}>
          To the fullest extent permitted by law, The Callsheet is not liable for indirect, incidental, or consequential damages arising from use of the service, including delays in Stripe payouts, disputes between users, or third-party service outages. Our aggregate liability related to a specific payment is limited to the platform fees retained on that payment.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>11. Changes</h2>
        <p style={{ marginBottom: 16 }}>
          We may update these Terms for the private beta. Continued use after changes constitutes acceptance of the updated Terms.
        </p>

        <h2 style={{ fontSize: 24, marginTop: 32, marginBottom: 16 }}>12. Contact</h2>
        <p style={{ marginBottom: 16 }}>
          Questions about these Terms: contact the operator via the support channels published on thecallsheet.ai.
        </p>
      </div>

      <div style={{ marginTop: 64, display: 'flex', gap: 12 }}>
        <Link to="/" className="btn btn-secondary">Return Home</Link>
        <Link to="/privacy" className="btn btn-ghost">Privacy Policy</Link>
      </div>
    </div>
  )
}
