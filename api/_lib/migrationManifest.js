/**
 * Ordered Supabase SQL migrations. Keep in sync with supabase/MIGRATIONS.md.
 * Filenames are relative to the supabase/ directory.
 */
export const CORE_MIGRATIONS = [
  'schema.sql',
  'admin-setup.sql',
  'artist-applications.sql',
  'artist-invites.sql',
]

export const PAYMENTS_MIGRATIONS = [
  'payments-escrow.sql',
  'bookings-payments-fix.sql',
  'product-gaps-migration.sql',
  'contract-milestones.sql',
  'contract-attachments-storage.sql',
  'booking-contract-link.sql',
  'disputes.sql',
  'dispute-payouts-migration.sql',
  'milestone-deliverables.sql',
  'contract-signature-audit.sql',
]

export const FEATURE_MIGRATIONS = [
  'notifications.sql',
  'realtime-messages.sql',
  'message-read-receipts.sql',
  'push-subscriptions.sql',
  'google-calendar-sync.sql',
  'calendar-connections-rls.sql',
  'reviews-visibility.sql',
  'review-responses.sql',
  'brand-verification.sql',
  'portfolio-storage.sql',
  'employer-tax-vault.sql',
]

/** Tracking table bootstrap — apply once before recording other migrations. */
export const TRACKING_MIGRATION = 'schema-migrations.sql'

/** Full required order for money-ready environments (excludes optional seed). */
export const REQUIRED_MIGRATIONS = [
  TRACKING_MIGRATION,
  ...CORE_MIGRATIONS,
  ...PAYMENTS_MIGRATIONS,
]

export const ALL_TRACKED_MIGRATIONS = [
  TRACKING_MIGRATION,
  ...CORE_MIGRATIONS,
  ...PAYMENTS_MIGRATIONS,
  ...FEATURE_MIGRATIONS,
]
