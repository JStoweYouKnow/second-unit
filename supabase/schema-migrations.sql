-- Applied-migration ledger for The Callsheet.
-- Run this first (or once) so scripts/verify-migrations.mjs can check status.
-- After applying any other supabase/*.sql file, insert a row:
--   INSERT INTO public.schema_migrations (filename)
--   VALUES ('payments-escrow.sql')
--   ON CONFLICT (filename) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no public policies (ledger is server/ops only).

INSERT INTO public.schema_migrations (filename, notes)
VALUES ('schema-migrations.sql', 'Tracking table bootstrap')
ON CONFLICT (filename) DO NOTHING;
