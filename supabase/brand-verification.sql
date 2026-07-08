-- Admin-verified client credits on artist profiles.
alter table artist_brands
  add column if not exists verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references profiles(id) on delete set null;

comment on column artist_brands.verified is 'True when an admin has confirmed this client credit.';
