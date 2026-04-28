-- =============================================================================
-- Security Audit (2026-04-28) — Consolidated migration
-- =============================================================================
-- Captures all schema/policy changes applied during the pre-launch security audit.
-- Idempotent (safe to re-run on a fresh DB or existing one).
--
-- Reference: AUDIT_REPORT.md (P0/P1 items)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. UNIQUE index — orders payment_key (partial: excluding admin-issued)
-- -----------------------------------------------------------------------------
-- Prevents race in /api/payment/confirm where two concurrent calls with the same
-- paymentKey could insert duplicate orders/licenses. Admin-issued orders use
-- payment_key='admin:...' and may legitimately repeat, so they are excluded.

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_key_product_idx
  ON orders (payment_key, product_id)
  WHERE payment_key IS NOT NULL
    AND payment_key NOT LIKE 'admin:%';


-- -----------------------------------------------------------------------------
-- 2. RLS policy — comments INSERT (constrain is_admin column)
-- -----------------------------------------------------------------------------
-- Without this, an anon-key client could INSERT a comment with is_admin: true,
-- impersonating admin. WITH CHECK enforces is_admin=false unless caller is admin.

DROP POLICY IF EXISTS "Users can insert comments" ON comments;
CREATE POLICY "Users can insert comments" ON comments
  FOR INSERT TO public
  WITH CHECK (
    auth.uid() = user_id
    AND (
      is_admin = false
      OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
    )
  );


-- -----------------------------------------------------------------------------
-- 3. RLS policy — coupons SELECT (admin only)
-- -----------------------------------------------------------------------------
-- Previous policy allowed anyone with anon key to enumerate all coupon codes.
-- /api/coupon validates single codes via service_role and is unaffected.

DROP POLICY IF EXISTS "Anyone can read coupons" ON coupons;
CREATE POLICY "Admins can read coupons" ON coupons
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));


-- -----------------------------------------------------------------------------
-- 4. RLS policy — orders INSERT removed
-- -----------------------------------------------------------------------------
-- Users could previously insert fake "paid" order rows directly.
-- Only service_role (server API routes) can insert orders now.

DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
-- (no replacement = service_role only)


-- -----------------------------------------------------------------------------
-- 5. CHECK constraints — content length limits
-- -----------------------------------------------------------------------------
-- DB-level guardrails against abuse via massive text payloads.
-- NOT VALID skips existing rows; only new INSERT/UPDATE are checked.

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_title_length;
ALTER TABLE posts ADD CONSTRAINT posts_title_length
  CHECK (char_length(title) <= 200) NOT VALID;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_description_length;
ALTER TABLE posts ADD CONSTRAINT posts_description_length
  CHECK (char_length(description) <= 10000) NOT VALID;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_content_length;
ALTER TABLE comments ADD CONSTRAINT comments_content_length
  CHECK (char_length(content) <= 2000) NOT VALID;

ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_title_length;
ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_title_length
  CHECK (char_length(title) <= 200) NOT VALID;

ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_description_length;
ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_description_length
  CHECK (char_length(description) <= 10000) NOT VALID;


-- -----------------------------------------------------------------------------
-- 6. Storage bucket — uploads file size + MIME whitelist
-- -----------------------------------------------------------------------------
-- 50MB hard limit. Allow only image types and zip/octet-stream (for .rbz files).

UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]
WHERE id = 'uploads';


-- -----------------------------------------------------------------------------
-- 7. Storage RLS — uploads INSERT path-based restriction
-- -----------------------------------------------------------------------------
-- Users can only upload to their own user-id-scoped folders. service_role
-- (admin upload route) bypasses RLS.

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Users can upload to own folders" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth.role() = 'authenticated'
    AND (
      name LIKE 'openlab/' || auth.uid()::text || '/%'
      OR name LIKE 'bug-reports/' || auth.uid()::text || '/%'
      OR name LIKE 'systems/' || auth.uid()::text || '/%'
    )
  );


-- -----------------------------------------------------------------------------
-- 8. FK ON DELETE policies — proper user deletion handling
-- -----------------------------------------------------------------------------
-- Previous: all NO ACTION → user deletion failed when any related row existed.
-- New design:
--   * orders / comments / posts / bug_reports → SET NULL
--     (anonymize and preserve for legal retention — orders required 5y by 전자상거래법)
--   * licenses / subscriptions / course_progress / admins → CASCADE
--     (clean up with user account)

-- Make user_id NULLABLE for SET NULL targets
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE comments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE bug_reports ALTER COLUMN user_id DROP NOT NULL;

-- SET NULL group
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_user_id_fkey;
ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- CASCADE group
ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_user_id_fkey;
ALTER TABLE licenses ADD CONSTRAINT licenses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE course_progress DROP CONSTRAINT IF EXISTS course_progress_user_id_fkey;
ALTER TABLE course_progress ADD CONSTRAINT course_progress_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_user_id_fkey;
ALTER TABLE admins ADD CONSTRAINT admins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
