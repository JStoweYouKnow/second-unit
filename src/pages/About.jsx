import { Link } from 'react-router-dom'
import SiteDocLayout from '../components/SiteDocLayout'

export default function About() {
  return (
    <SiteDocLayout title="About us" updated="July 2026" currentPath="/about">
      <h2>What we’re building</h2>
      <p>
        The Callsheet is a marketplace for AI-native creatives and the teams that hire them.
        We bring discovery, availability, messaging, bookings, agreements, milestone payments,
        and dispute tools into one place so production work can move with less friction.
      </p>

      <h2>Who it’s for</h2>
      <p>
        <strong>Artists</strong> publish profiles, set rates and availability, accept bookings,
        and get paid through Stripe Connect after work is approved.
      </p>
      <p>
        <strong>Hirers</strong> find talent, book time or project blocks, fund milestones in
        platform escrow, review deliverables, and release payment when ready.
      </p>

      <h2>How we think about trust</h2>
      <p>
        Payments are processed by Stripe. Funds for milestones and bookings are held by the
        platform until the hirer approves release. Artists complete Connect onboarding before
        payouts can land. Disputes can be opened on-platform when something goes wrong—without
        replacing rights you may have under law or with your payment provider.
      </p>

      <h2>Private beta</h2>
      <p>
        We’re in private beta. Features ship quickly; invite and application flows may apply for
        artists. Feedback from early users shapes what we build next.
      </p>

      <h2>Contact</h2>
      <p>
        Reach us at{' '}
        <a href="mailto:support@thecallsheet.ai">support@thecallsheet.ai</a>
        {' '}or visit the{' '}
        <Link to="/help">Help</Link> page for common questions.
      </p>
    </SiteDocLayout>
  )
}
