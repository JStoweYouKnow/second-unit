# Supabase SQL migration ledger

Apply these in order on a fresh project (or apply only files not yet run).  
There is no automated migrator in this repo yet — treat this file as the source of truth.

## Core (required)

| Order | File | Purpose |
|------:|------|---------|
| 1 | `schema.sql` | Base tables, RLS, `handle_new_user` |
| 2 | `seed.sql` | Optional demo seed (dev only) |
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

## Product features (recommended)

| Order | File | Purpose |
|------:|------|---------|
| 15 | `notifications.sql` | In-app notifications |
| 16 | `realtime-messages.sql` | Message realtime |
| 17 | `message-read-receipts.sql` | Read receipts |
| 18 | `push-subscriptions.sql` | Web push |
| 19 | `google-calendar-sync.sql` | Calendar OAuth sync |
| 20 | `calendar-connections-rls.sql` | RLS on calendar token tables |
| 21 | `reviews-visibility.sql` | Review visibility |
| 22 | `review-responses.sql` | Artist review responses |
| 23 | `brand-verification.sql` | Verified client credits |
| 24 | `portfolio-storage.sql` | Portfolio media bucket |

## Ad-hoc fixes (run only if needed)

- `fix-invite-uuid.sql`
- `fix-invite-validate.sql`
- `fix-database-error-new-user.sql`

## Checklist before taking real money

- [ ] All **Payments & contracts** files applied
- [ ] `milestone-deliverables.sql` applied (if using deliverables / release request)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set on Vercel + Railway/API host
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set (live keys for production)
- [ ] Stripe webhook endpoint points at `/api/webhooks/stripe`
- [ ] `/api/health` reports `readyForMoney: true` and `stripeMode: "live"` (or `"test"` in staging)

## Do not commit

- `supabase/.temp/` (CLI cache)
