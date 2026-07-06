-- =============================================
-- Artist Application & Approval Workflow
-- Run in Supabase SQL Editor after schema.sql
-- =============================================

create type application_status as enum ('pending', 'approved', 'rejected');

-- =============================================
-- ARTIST APPLICATIONS
-- =============================================
create table if not exists artist_applications (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  email text not null,
  full_name text not null,
  role_title text not null,
  bio text,
  location text,
  hourly_rate integer default 0,
  skills text[] default '{}',
  brands text[] default '{}',
  website text,
  twitter text,
  instagram text,
  linkedin text,
  video_links text[] default '{}',
  status application_status not null default 'pending',
  rejection_reason text,
  admin_notes text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_artist_applications_status on artist_applications(status);
create index if not exists idx_artist_applications_created on artist_applications(created_at desc);

-- =============================================
-- HELPERS
-- =============================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::user_role
  );
$$;

create or replace function public.sync_artist_skill_names(p_artist_id uuid, p_skill_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  skill_name text;
  skill_uuid uuid;
begin
  delete from artist_skills where artist_id = p_artist_id;

  if p_skill_names is null then
    return;
  end if;

  foreach skill_name in array p_skill_names loop
    skill_name := trim(skill_name);
    if skill_name = '' then
      continue;
    end if;

    insert into skills (name)
    values (skill_name)
    on conflict (name) do nothing;

    select id into skill_uuid from skills where name = skill_name;
    if skill_uuid is not null then
      insert into artist_skills (artist_id, skill_id)
      values (p_artist_id, skill_uuid)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.sync_artist_brand_names(p_artist_id uuid, p_brand_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  brand_name text;
  brand_uuid uuid;
begin
  delete from artist_brands where artist_id = p_artist_id;

  if p_brand_names is null then
    return;
  end if;

  foreach brand_name in array p_brand_names loop
    brand_name := trim(brand_name);
    if brand_name = '' then
      continue;
    end if;

    insert into brands (name)
    values (brand_name)
    on conflict (name) do nothing;

    select id into brand_uuid from brands where name = brand_name;
    if brand_uuid is not null then
      insert into artist_brands (artist_id, brand_id)
      values (p_artist_id, brand_uuid)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.approve_artist_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app_row artist_applications%rowtype;
  artist_uuid uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve applications';
  end if;

  select * into app_row
  from artist_applications
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

create or replace function public.reject_artist_application(
  p_application_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reject applications';
  end if;

  update artist_applications
  set status = 'rejected',
      rejection_reason = nullif(trim(p_reason), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id
    and status = 'pending';

  if not found then
    raise exception 'Pending application not found';
  end if;
end;
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table artist_applications enable row level security;

create policy "Applicants can view own application"
  on artist_applications for select
  using (auth.uid() = profile_id or public.is_admin());

create policy "Applicants can submit application"
  on artist_applications for insert
  with check (auth.uid() = profile_id);

create policy "Applicants can update own pending or rejected application"
  on artist_applications for update
  using (
    (auth.uid() = profile_id and status in ('pending', 'rejected'))
    or public.is_admin()
  );

-- Skills & brands: artists and admins can manage junction rows
create policy "Artists manage own skills"
  on artist_skills for all
  using (auth.uid() in (select profile_id from artists where id = artist_id))
  with check (auth.uid() in (select profile_id from artists where id = artist_id));

create policy "Admins manage artist skills"
  on artist_skills for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Artists manage own brands"
  on artist_brands for all
  using (auth.uid() in (select profile_id from artists where id = artist_id))
  with check (auth.uid() in (select profile_id from artists where id = artist_id));

create policy "Admins manage artist brands"
  on artist_brands for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authenticated users can add skills"
  on skills for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can add brands"
  on brands for insert
  with check (auth.uid() is not null);

-- Admins can update any profile role (for approval side effects via definer functions)
create policy "Admins can update profiles"
  on profiles for update
  using (public.is_admin());

grant execute on function public.approve_artist_application(uuid) to authenticated;
grant execute on function public.reject_artist_application(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
