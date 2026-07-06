-- Escrow/payout tracking columns for the payments table.
-- Implements the 15% platform fee + 85% deferred artist payout model.
-- Run once against your Supabase project.

alter table payments
  add column if not exists artist_stripe_account_id text,
  add column if not exists platform_fee_amount       integer,  -- cents (15% of total)
  add column if not exists artist_payout_amount      integer,  -- cents (85% of total)
  add column if not exists payout_status             text not null default 'pending',
  add column if not exists transfer_id               text;     -- Stripe transfer ID set on completion
