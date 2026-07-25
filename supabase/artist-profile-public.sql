-- Dedicated public profile header image + Spotlight listing toggle.
-- Run after artist-featured-header.sql

alter table public.artists
  add column if not exists header_image_url text,
  add column if not exists is_public boolean not null default true;

comment on column public.artists.header_image_url is
  'Dedicated header/banner image URL for the public artist profile. Takes priority over portfolio auto-pick.';

comment on column public.artists.is_public is
  'When false, artist is hidden from Artist Spotlight and public discovery (direct link still works for owner).';

create index if not exists idx_artists_is_public
  on public.artists(is_public)
  where is_public = true;
