-- Run after schema.sql, reviews-visibility.sql, payments-escrow.sql
-- Adds fields for contracts, multi-rate pricing, and review upserts.

alter table artists
  add column if not exists day_rate integer,
  add column if not exists project_flat_rate integer;

alter table contracts
  add column if not exists employer_signature jsonb,
  add column if not exists artist_signature jsonb,
  add column if not exists attachment_name text,
  add column if not exists attachment_url text,
  add column if not exists attachment_mime text,
  add column if not exists client_name text,
  add column if not exists booking_id uuid references bookings(id);

create unique index if not exists reviews_reviewer_artist_unique
  on reviews (reviewer_id, reviewee_artist_id)
  where reviewee_artist_id is not null;
