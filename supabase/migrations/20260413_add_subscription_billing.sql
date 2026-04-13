-- Add Toss 빌링키 fields to subscriptions table
-- Run this once in Supabase SQL Editor.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_key           TEXT,
  ADD COLUMN IF NOT EXISTS customer_key          TEXT,
  ADD COLUMN IF NOT EXISTS amount                INTEGER,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canceled_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_key      TEXT,
  ADD COLUMN IF NOT EXISTS last_charged_at       TIMESTAMPTZ;

-- Index to accelerate the nightly cron query:
-- "find active subscriptions whose period ends soon and are not set to cancel"
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expiry
  ON public.subscriptions (status, expires_at)
  WHERE status = 'active';
