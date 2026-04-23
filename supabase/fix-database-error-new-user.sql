-- =============================================================================
-- Fix: "Database error saving new user" when signing up (Supabase Auth)
--
-- Typical causes:
-- 1) handle_new_user() is not SECURITY DEFINER, or not owned by postgres —
--    the auth trigger runs as supabase_auth_admin and cannot insert profiles.
-- 2) Missing SET search_path → wrong schema / type resolution at runtime.
--
-- Run this entire script in Supabase → SQL Editor (as postgres).
-- Then retry sign-up. Check Logs → Postgres if anything still fails.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  safe_role public.user_role;
  display_name text;
begin
  if (meta->>'role') in ('employer', 'artist') then
    safe_role := (meta->>'role')::public.user_role;
  else
    safe_role := 'employer'::public.user_role;
  end if;

  display_name := coalesce(
    nullif(trim(meta->>'full_name'), ''),
    nullif(trim(meta->>'name'), ''),
    nullif(
      trim(concat_ws(' ', nullif(trim(meta->>'given_name'), ''), nullif(trim(meta->>'family_name'), ''))),
      ''
    ),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    display_name,
    coalesce(
      nullif(trim(meta->>'avatar_url'), ''),
      nullif(trim(meta->>'picture'), '')
    ),
    safe_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
