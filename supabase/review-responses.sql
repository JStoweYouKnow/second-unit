-- Artist replies on hirer reviews (one response per review).
-- Run after reviews-visibility.sql

alter table reviews
  add column if not exists artist_response text,
  add column if not exists artist_response_at timestamptz;

create index if not exists idx_reviews_response_at
  on reviews(reviewee_artist_id, artist_response_at desc)
  where artist_response is not null;
