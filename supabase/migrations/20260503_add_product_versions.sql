-- Per-version installer history for products.
-- Replaces the single products.file_key/version pair with a row per release,
-- so users can see what changed and admins can keep older binaries around.
--
-- products.version / products.file_key are kept as a "latest cache" so the
-- existing /api/download and mypage code keep working unchanged. New version
-- inserts MUST also update products.version + file_key in the same write path.

CREATE TABLE IF NOT EXISTS public.product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version text NOT NULL,
  file_key text,
  changelog text,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);

CREATE INDEX IF NOT EXISTS product_versions_product_released_idx
  ON public.product_versions (product_id, released_at DESC);

-- Backfill: lift existing products.version/file_key into product_versions as
-- the first release. Only for products that have a version set and no row yet.
INSERT INTO public.product_versions (product_id, version, file_key, changelog, released_at)
SELECT p.id, p.version, p.file_key, NULL, COALESCE(p.created_at, now())
FROM public.products p
WHERE p.version IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.product_versions pv WHERE pv.product_id = p.id
  );

-- RLS — Supabase auto-enables RLS on new tables. Without policies the table
-- is invisible to anon/authenticated. Mirror the access model: changelog is
-- public (mypage needs to render it client-side), writes are admin-only.
-- Service role bypasses RLS so the admin API routes are unaffected.
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_versions readable by all" ON public.product_versions;
CREATE POLICY "product_versions readable by all"
  ON public.product_versions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "product_versions writable by admins" ON public.product_versions;
CREATE POLICY "product_versions writable by admins"
  ON public.product_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));
