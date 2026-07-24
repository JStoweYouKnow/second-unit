# Supabase SQL migration ledger

Apply these in order on a fresh project (or apply only files not yet run).  
Source of truth for order: this file + `api/_lib/migrationManifest.js`.

After each file, record it:

```bash
npm run record:migration -- <filename.sql>
```

Verify against the database:

```bash
npm run verify:migrations -- --required-only   # money-ready set
npm run verify:migrations                      # includes product features
```

## Tracking (run first)

| Order | File | Purpose |
|------:|------|---------|
| 0 | `schema-migrations.sql` | `public.schema_migrations` ledger |

## Core (required)

| Order | File | Purpose |
|------:|------|---------|
| 1 | `schema.sql` | Base tables, RLS, `handle_new_user` |
| 2 | `seed.sql` | Optional demo seed (dev only) — do not record as required |
| 3 | `admin-setup.sql` | Admin helpers / `is_admin` |
| 4 | `artist-applications.sql` | Artist applications |
| 5 | `artist-invites.sql` | Invite-only apply |

## Payments & contracts (required for money)

| Order | File | Purpose |
|------:|------|---------|
| 6 | `payments-escrow.sql` | Escrow / payout columns on payments |
| 7 | `bookings-payments-fix.sql` | Booking/payment consistency fixes |
| 8 | `product-gaps-migration.sql` | Contract attachment metadata, etc. |
| 9 | `contract-milestones.sql` | Milestone schedule + statuses |
| 10 | `contract-attachments-storage.sql` | Agreement PDF/Word bucket |
| 11 | `booking-contract-link.sql` | Booking ↔ contract link |
| 12 | `disputes.sql` | Dispute cases |
| 13 | `dispute-payouts-migration.sql` | Dispute refund/release payouts |
| 14 | `milestone-deliverables.sql` | Deliverables + release requests + storage |
| 15 | `contract-signature-audit.sql` | Typed e-sign audit events + document hash |

## Product features (recommended)

| Order | File | Purpose |
|------:|------|---------|
| 16 | `notifications.sql` | In-app notifications |
| 17 | `realtime-messages.sql` | Message realtime |
| 18 | `message-read-receipts.sql` | Read receipts |
| 19 | `push-subscriptions.sql` | Web push |
| 20 | `google-calendar-sync.sql` | Calendar OAuth sync |
| 21 | `calendar-connections-rls.sql` | RLS on calendar token tables |
| 22 | `reviews-visibility.sql` | Review visibility |
| 23 | `review-responses.sql` | Artist review responses |
| 24 | `brand-verification.sql` | Verified client credits |
| 25 | `portfolio-storage.sql` | Portfolio media bucket |
| 26 | `employer-tax-vault.sql` | Hirer company fields + tax doc vault |

## Ad-hoc fixes (run only if needed)

- `fix-invite-uuid.sql`
- `fix-invite-validate.sql`
- `fix-database-error-new-user.sql`

## Checklist before taking real money

- [ ] `schema-migrations.sql` applied
- [ ] All **Payments & contracts** files applied and recorded (`npm run verify:migrations -- --required-only`)
- [ ] `milestone-deliverables.sql` applied (if using deliverables / release request)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set on Vercel + Railway/API host
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set (live keys for production)
- [ ] Stripe webhook endpoint points at `/api/webhooks/stripe`
- [ ] `/api/health` reports `readyForMoney: true` and `stripeMode: "live"` (or `"test"` in staging)

## Do not commit

- `supabase/.temp/` (CLI cache)
