-- =============================================
-- Private Artist Invite Links
-- Run in Supabase SQL Editor after artist-applications.sql
-- =============================================

create table if not exists artist_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  artist_name text,
  email text,
  note text,
  created_by uuid references profiles(id),
  expires_at timestamptz,
  used_at timestamptz,
  used_by_profile_id uuid references profiles(id),
  application_id uuid references artist_applications(id),
  created_at timestamptz default now()
);

create index if not exists idx_artist_invites_token on artist_invites(token);
create index if not exists idx_artist_invites_created on artist_invites(created_at desc);

alter table artist_applications
  add column if not exists invite_id uuid references artist_invites(id);

-- =============================================
-- VALIDATE (public via RPC — no direct table access needed)
-- =============================================
create or replace function public.validate_artist_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv artist_invites%rowtype;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'missing');
  end if;

  select * into inv
  from artist_invites
  where token = trim(p_token);

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;

  if inv.used_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'used');
  end if;

  if inv.expires_at is not null and inv.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  return jsonb_build_object(
    'valid', true,
    'reason', null,
    'artist_name', inv.artist_name,
    'email', inv.email,
    'invite_id', inv.id
  );
end;
$$;

-- =============================================
-- CREATE (admin only)
-- =============================================
create or replace function public.create_artist_invite(
  p_artist_name text default null,
  p_email text default null,
  p_note text default null,
  p_expires_days integer default 30
)
returns artist_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  new_invite artist_invites;
  safe_days integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create invites';
  end if;

  safe_days := greatest(coalesce(p_expires_days, 30), 1);

  insert into artist_invites (
    token,
    artist_name,
    email,
    note,
    created_by,
    expires_at
  )
  values (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    nullif(trim(p_artist_name), ''),
    nullif(lower(trim(p_email)), ''),
    nullif(trim(p_note), ''),
    auth.uid(),
    now() + (safe_days || ' days')::interval
  )
  returning * into new_invite;

  return new_invite;
end;
$$;

-- =============================================
-- CONSUME on application submit
-- =============================================
create or replace function public.consume_artist_invite(
  p_token text,
  p_profile_id uuid,
  p_application_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv artist_invites%rowtype;
  validation jsonb;
begin
  validation := public.validate_artist_invite(p_token);

  if not (validation->>'valid')::boolean then
    raise exception 'Invite is not valid';
  end if;

  select * into inv
  from artist_invites
  where token = trim(p_token)
  for update;

  if inv.email is not null and lower(trim(p_email)) <> inv.email then
    raise exception 'This invite is reserved for a different email address';
  end if;

  update artist_invites
  set used_at = now(),
      used_by_profile_id = p_profile_id,
      application_id = p_application_id
  where id = inv.id;

  update artist_applications
  set invite_id = inv.id
  where id = p_application_id;
end;
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table artist_invites enable row level security;

create policy "Admins can view all invites"
  on artist_invites for select
  using (public.is_admin());

create policy "Admins can manage invites"
  on artist_invites for all
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.validate_artist_invite(text) to anon, authenticated;
grant execute on function public.create_artist_invite(text, text, text, integer) to authenticated;
grant execute on function public.consume_artist_invite(text, uuid, uuid, text) to authenticated;
