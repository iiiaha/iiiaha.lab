-- Track the host program versions the post author is running.
-- Helps reproduce bug reports and scope idea/feature discussions.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS sketchup_version TEXT,
  ADD COLUMN IF NOT EXISTS autocad_version TEXT;
