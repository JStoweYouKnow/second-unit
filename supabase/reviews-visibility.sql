-- Optional migration: artist-controlled public reviews (run after schema.sql)
-- App currently persists visibility in localStorage for demo mode.

alter table artists
  add column if not exists show_reviews_on_profile boolean not null default true;

alter table reviews
  add column if not exists visible_on_profile boolean not null default true,
  add column if not exists reviewer_name text,
  add column if not exists reviewer_company text;

-- Hirers can insert; artists update visibility on their rows
create policy "Artists can update review visibility" on reviews for update
  using (
    auth.uid() in (select profile_id from artists where id = reviewee_artist_id)
  );
