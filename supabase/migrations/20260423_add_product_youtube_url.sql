-- YouTube operation video URL for product detail page hero.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;
