-- 마이페이지에 등록된 카드를 식별 가능하도록 표시하기 위한 컬럼.
-- Toss billing/authorizations/issue 응답의 cardCompany, cardNumber(마스킹된 형태)를 그대로 저장.
-- Run this once in Supabase SQL Editor.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS card_company        TEXT,
  ADD COLUMN IF NOT EXISTS card_number_masked  TEXT;
