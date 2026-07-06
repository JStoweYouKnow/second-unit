-- Fix: "function uuid_generate_v4() does not exist" when creating artist invites
-- Run this in the Supabase SQL Editor

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
