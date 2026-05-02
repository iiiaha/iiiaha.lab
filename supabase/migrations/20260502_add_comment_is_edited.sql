-- =============================================================================
-- 댓글 수정 추적 — is_edited 플래그 추가 (2026-05-02)
-- =============================================================================
-- 작성자가 댓글을 수정한 경우 UI에 "수정됨" 표시를 위한 플래그.
-- API 라우트(/api/comments/[id] PATCH)에서 service_role로 직접 true 세팅.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false;
