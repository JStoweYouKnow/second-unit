import { Link } from 'react-router-dom'
import SiteDocLayout from '../components/SiteDocLayout'

export default function Help() {
  return (
    <SiteDocLayout title="Help" updated="July 2026" currentPath="/help">
      <p>
        Short answers for getting work done on The Callsheet. Still stuck? Email{' '}
        <a href="mailto:support@thecallsheet.ai">support@thecallsheet.ai</a>.
      </p>

      <h2>Getting started</h2>
      <h3>How do I join?</h3>
      <p>
        Create an account from{' '}
        <Link to="/signup">Sign up</Link>. Artists may need an invite and an approved application
        before a public profile is live. Hirers can join subject to private beta access.
      </p>
      <h3>Where do I manage my profile?</h3>
      <p>
        Artists: use <strong>Dashboard</strong> for availability, payouts, and profile shortcuts,
        and edit public details from your artist profile. Everyone: <strong>Account</strong> for
        login, notifications, and business/tax settings.
      </p>

      <h2>Booking &amp; availability</h2>
      <h3>How do hirers book time?</h3>
      <p>
        Open an artist’s profile → <strong>View Calendar</strong>. Choose <strong>Hours</strong> for
        a same-day contiguous block, or <strong>Days</strong> for a multi-day range where every day
        has open availability. Continue to Bookings to confirm fee, notes, and send the request.
      </p>
      <h3>How do artists open hours?</h3>
      <p>
        On the Dashboard availability calendar, set your working timezone, pick dates, and toggle
        open hour segments (or use presets). Leave hours off to block that part of the day. Booked
        slots stay locked.
      </p>

      <h2>Payments</h2>
      <h3>When does the artist get paid?</h3>
      <p>
        After the hirer funds a booking or milestone and later approves release, The Callsheet
        transfers the artist share via Stripe Connect (minus the platform fee). Bank arrival
        follows Stripe’s payout schedule—not instantly on approval.
      </p>
      <h3>Why can’t I receive payouts?</h3>
      <p>
        Complete Stripe Connect onboarding from Earnings / Dashboard until payouts are enabled.
        Transfers fail until that is finished.
      </p>

      <h2>Projects &amp; disputes</h2>
      <h3>Agreements</h3>
      <p>
        Projects can use the standard Callsheet agreement, typed custom terms, and/or an uploaded
        PDF/Word file. Signing is a typed electronic signature recorded with timestamp and account
        details—not third-party identity-proofed e-sign.
      </p>
      <h3>Opening a dispute</h3>
      <p>
        Use <strong>Disputes</strong> from the app nav when you need platform mediation. Outcomes
        may include refund, release, split, or no payment action. See also our{' '}
        <Link to="/terms">Terms of Service</Link>.
      </p>

      <h2>Account &amp; privacy</h2>
      <p>
        Password reset is available from Sign in. For how we handle data, read the{' '}
        <Link to="/privacy">Privacy Policy</Link>. For who we are, see{' '}
        <Link to="/about">About us</Link>.
      </p>
    </SiteDocLayout>
  )
}
