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
      <h3>Interactive guide</h3>
      <p>
        When you&apos;re signed in, open the step-by-step onboarding popup from <strong>Getting started</strong> in
        the sidebar, or visit{' '}
        <Link to="/dashboard?guide=1">Dashboard with the guide</Link> (the app picks the right tour for your role:
        artist, hirer, or admin).
      </p>
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
      <h3>How do hirers book an artist?</h3>
      <ol>
        <li>
          Open the artist&apos;s profile and click <strong>View Calendar</strong>.
        </li>
        <li>
          Choose how long you need them:
          <ul>
            <li>
              <strong>Hours</strong> — one day, part of the day (e.g. a 2-hour call or afternoon session).
              Click the day on the calendar, then click a <strong>start hour</strong> and an <strong>end hour</strong>.
            </li>
            <li>
              <strong>Days</strong> — several full days in a row (e.g. a 3-day shoot).
              Click the <strong>first day</strong>, then the <strong>last day</strong>.
              Every day in that range must show as open on the artist&apos;s calendar.
            </li>
          </ul>
        </li>
        <li>
          Check the summary at the bottom of the calendar, then click <strong>Continue to book</strong>.
        </li>
        <li>
          On <strong>Bookings</strong>, confirm the dates, fee, and any notes, then send the request.
          The artist accepts or declines from their Schedule.
        </li>
      </ol>
      <h3>How do artists open hours?</h3>
      <ol>
        <li>
          From <strong>Dashboard</strong> or <strong>My profile → Edit Availability</strong>.
        </li>
        <li>
          Set your <strong>working timezone</strong> so hirers see the correct local times.
        </li>
        <li>
          Click a future date on the calendar.
        </li>
        <li>
          Tap hour blocks to mark them <strong>open</strong> for booking (or use a preset like Morning / Full day).
          Leave hours off to keep that time blocked.
        </li>
        <li>
          Click <strong>Save this day</strong>. Repeat for other dates you want bookable.
        </li>
      </ol>
      <p>
        Booked slots stay locked and can&apos;t be removed until the booking is cancelled or completed.
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
        PDF/Word file. You and the other party sign independently in any order — typed electronic
        signatures are recorded with timestamp and account details (not third-party identity-proofed e-sign).
        Milestone payments unlock once both signatures are on file.
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
