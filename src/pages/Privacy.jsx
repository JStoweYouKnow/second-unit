import SiteDocLayout from '../components/SiteDocLayout'

export default function Privacy() {
  return (
    <SiteDocLayout title="Privacy Policy" updated="July 2026" currentPath="/privacy">
      <h2>1. Information We Collect</h2>
      <p>
        We collect information you provide directly to us, such as when you create or modify your account,
        request services, contact support, or otherwise communicate with us. This may include name, email,
        profile and portfolio content, booking and project details, and messages you send on the platform.
      </p>
      <p>
        Payment card and bank details are collected and processed by Stripe. We receive payment-related
        identifiers and status information needed to run checkout, escrow, and payouts—not full card numbers.
      </p>

      <h2>2. How We Use Information</h2>
      <p>
        We use the information we collect to provide, maintain, and improve The Callsheet: accounts,
        discovery, messaging, bookings, agreements, payments, dispute handling, security, and service
        communications (including receipts and important account notices).
      </p>

      <h2>3. Sharing</h2>
      <p>
        We share information with service providers that help us operate the product (notably Stripe for
        payments, and hosting/infrastructure vendors). Profile and booking details you choose to publish
        or send are visible to the relevant counterparties on the platform. We do not sell your personal
        information.
      </p>

      <h2>4. Data Security</h2>
      <p>
        We take reasonable measures to help protect information about you from loss, theft, misuse, and
        unauthorized access, disclosure, alteration, and destruction. No method of transmission or storage
        is completely secure.
      </p>

      <h2>5. Retention &amp; your choices</h2>
      <p>
        We retain account and transaction records as needed to operate the service and meet legal and
        accounting obligations. You may update profile information in Account settings. Contact us to
        request account deletion subject to outstanding payments, disputes, or legal holds.
      </p>

      <h2>6. Contact</h2>
      <p>
        Privacy questions: <a href="mailto:support@thecallsheet.ai">support@thecallsheet.ai</a>.
      </p>
    </SiteDocLayout>
  )
}
