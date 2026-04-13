-- Track when the user first downloaded the .rbz for a single-purchase order.
-- Used to disable self-service refund once the user has taken the file.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS download_acknowledged_at TIMESTAMPTZ;
