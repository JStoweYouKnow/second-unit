-- =============================================================================
-- Master admin + OAuth (Google, GitHub, LinkedIn) — Supabase setup
-- Run selected statements in the Supabase SQL Editor as noted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Promote an existing user to platform admin (master login)
--
-- Create the account first: Authentication → Users → "Add user" (email/password)
-- or sign up through your app, then run (replace the email):
-- -----------------------------------------------------------------------------

-- update public.profiles
-- set role = 'admin'::user_role, updated_at = now()
-- where lower(email) = lower('admin@yourdomain.com');

-- -----------------------------------------------------------------------------
-- 2) If sign-up shows "Database error saving new user"
--
-- Run the full script in: supabase/fix-database-error-new-user.sql
-- (replaces handle_new_user + trigger with SECURITY DEFINER + search_path + owner)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 3) Dashboard checklist — Authentication → Providers
--
-- Google:   enable, set Web client ID + secret from Google Cloud Console
--           OAuth client: Authorized redirect URI = Supabase "Callback URL"
-- GitHub:   enable, create OAuth App on GitHub → paste Client ID + Secret
-- LinkedIn: enable "LinkedIn (OIDC)" — create LinkedIn app → Client ID + Secret
--
-- Authentication → URL configuration
--   Site URL:        production app origin, e.g. https://your-app.vercel.app
--   Redirect URLs:   same + http://localhost:5173/ for local Vite dev
--
-- App env: set VITE_SITE_URL to that production origin so OAuth redirect matches
-- the allow list (see .env.example).
-- -----------------------------------------------------------------------------
