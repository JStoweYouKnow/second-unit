-- Named video reels: jsonb [{ "url": "...", "title": "..." }]
-- Keeps legacy video_links text[] in sync (URLs only) for older readers.
-- Run after artist-featured-header.sql / artist-applications.sql

alter table public.artists
  add column if not exists video_reels jsonb not null default '[]'::jsonb;

alter table public.artist_applications
  add column if not exists video_reels jsonb not null default '[]'::jsonb;

comment on column public.artists.video_reels is
  'Portfolio video reels as [{url, title}]. video_links mirrors URLs for compatibility.';
comment on column public.artist_applications.video_reels is
  'Application video reels as [{url, title}].';

-- Backfill from legacy URL arrays
update public.artists
set video_reels = coalesce((
  select jsonb_agg(jsonb_build_object('url', u, 'title', ''))
  from unnest(coalesce(video_links, '{}'::text[])) as u
  where nullif(trim(u), '') is not null
), '[]'::jsonb)
where video_reels = '[]'::jsonb
  and coalesce(cardinality(video_links), 0) > 0;

update public.artist_applications
set video_reels = coalesce((
  select jsonb_agg(jsonb_build_object('url', u, 'title', ''))
  from unnest(coalesce(video_links, '{}'::text[])) as u
  where nullif(trim(u), '') is not null
), '[]'::jsonb)
where video_reels = '[]'::jsonb
  and coalesce(cardinality(video_links), 0) > 0;

-- Approval copies named reels onto the artist row
create or replace function public.approve_artist_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app_row public.artist_applications%rowtype;
  artist_uuid uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve applications';
  end if;

  select * into app_row
  from public.artist_applications
  where id = p_application_id;

  if not found then
    raise exception 'Application not found';
  end if;

  if app_row.status <> 'pending' then
    raise exception 'Application is not pending';
  end if;

  update public.profiles
  set role = 'artist'::user_role,
      full_name = app_row.full_name,
      updated_at = now()
  where id = app_row.profile_id;

  insert into public.artists (
    profile_id,
    display_name,
    role_title,
    bio,
    hourly_rate,
    location,
    website,
    twitter,
    instagram,
    linkedin,
    video_links,
    video_reels,
    available
  )
  values (
    app_row.profile_id,
    app_row.full_name,
    app_row.role_title,
    app_row.bio,
    coalesce(app_row.hourly_rate, 0),
    app_row.location,
    app_row.website,
    app_row.twitter,
    app_row.instagram,
    app_row.linkedin,
    coalesce(app_row.video_links, '{}'::text[]),
    coalesce(app_row.video_reels, '[]'::jsonb),
    true
  )
  on conflict (profile_id) do update set
    display_name = excluded.display_name,
    role_title = excluded.role_title,
    bio = excluded.bio,
    hourly_rate = excluded.hourly_rate,
    location = excluded.location,
    website = excluded.website,
    twitter = excluded.twitter,
    instagram = excluded.instagram,
    linkedin = excluded.linkedin,
    video_links = excluded.video_links,
    video_reels = excluded.video_reels,
    updated_at = now()
  returning id into artist_uuid;

  perform public.sync_artist_skill_names(artist_uuid, app_row.skills);
  perform public.sync_artist_brand_names(artist_uuid, app_row.brands);

  update artist_applications
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id;

  return artist_uuid;
end;
$$;

alter function public.approve_artist_application(uuid) owner to postgres;
grant execute on function public.approve_artist_application(uuid) to authenticated;
