-- Bookings & payments alignment for app checkout flow
-- Run in Supabase SQL Editor after schema.sql

-- Allow "paid" booking status (checkout complete)
alter type booking_status add value if not exists 'paid';

-- App stores agreed flat/hourly totals separately from legacy rate column
alter table bookings
  add column if not exists agreed_total integer,
  add column if not exists duration_unit text default 'hours',
  add column if not exists artist_name text;

-- Backfill agreed_total from rate where missing
update bookings
set agreed_total = coalesce(agreed_total, rate * greatest(duration_hours, 1))
where agreed_total is null;

-- Service role / webhook inserts payments (participants read via RLS)
-- No extra policy needed — service role bypasses RLS.
