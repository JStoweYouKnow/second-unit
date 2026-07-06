-- Ensure invite validation works for anonymous users opening /apply?invite=...
-- Run in Supabase SQL Editor if invite links show a loading screen or "invalid" incorrectly.

-- Re-create validate function (safe to re-run)
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

grant execute on function public.validate_artist_invite(text) to anon, authenticated;
grant execute on function public.consume_artist_invite(text, uuid, uuid, text) to authenticated;
