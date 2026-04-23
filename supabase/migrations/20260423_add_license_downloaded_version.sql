-- Track which product version the user last downloaded for this license.
-- Compared with products.version on My Page to surface update availability.

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS last_downloaded_version TEXT;
