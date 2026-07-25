-- Let artists pin which portfolio image/video or external reel appears in the profile header.
-- Run after portfolio-storage.sql

alter table public.artists
  add column if not exists featured_portfolio_item_id uuid references public.portfolio_items(id) on delete set null,
  add column if not exists featured_video_link text;

comment on column public.artists.featured_portfolio_item_id is
  'Portfolio item (image or hosted video) shown in the public profile header. Null = auto.';
comment on column public.artists.featured_video_link is
  'External YouTube/Vimeo (or similar) URL featured in the header when no portfolio item is pinned.';

create index if not exists idx_artists_featured_portfolio
  on public.artists(featured_portfolio_item_id)
  where featured_portfolio_item_id is not null;
