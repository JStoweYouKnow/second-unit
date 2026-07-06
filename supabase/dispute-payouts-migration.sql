-- Dispute payout tracking + custom milestone amounts on contracts.
-- Run after disputes.sql and contract-milestones.sql

alter table disputes
  add column if not exists split_employer_cents integer,
  add column if not exists split_artist_cents integer,
  add column if not exists payout_status text not null default 'pending',
  add column if not exists payout_error text,
  add column if not exists payout_executed_at timestamptz;

alter table contracts
  add column if not exists milestone_amounts integer[];

comment on column contracts.milestone_amounts is 'Optional [m1,m2,m3] dollar amounts; defaults to 33/33/34 split when null';

alter table payments
  add column if not exists refund_id text,
  add column if not exists refunded_amount integer;

alter table profiles
  add column if not exists calendar_feed_token text unique;

create index if not exists idx_profiles_calendar_feed_token on profiles(calendar_feed_token);

alter table calendar_connections
  add column if not exists feed_token text unique;
