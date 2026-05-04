import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";
import { sendOperatorMail, escapeHtml } from "@/lib/alert";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_CONTENT_LENGTH = 2000;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(limiters.comments, getClientId(req, user.id));
  if (limited) return limited;

  const { post_id, content } = (await req.json()) as {
    post_id: string;
    content: string;
  };

  if (!post_id || typeof content !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content too long (max ${MAX_CONTENT_LENGTH} chars)` },
      { status: 400 }
    );
  }

  // 게시글 존재 확인 (orphan 댓글 방지) + 메일 알림용 메타 동시 fetch
  const { data: post } = await serviceSupabase
    .from("posts")
    .select("id, title, category")
    .eq("id", post_id)
    .maybeSingle();
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // is_admin은 서버에서 결정. 클라이언트가 보낸 값을 신뢰하지 않는다.
  const { data: adminRow } = await serviceSupabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = !!adminRow;

  const { error: insertErr } = await serviceSupabase.from("comments").insert({
    post_id,
    user_id: user.id,
    content: trimmed,
    is_admin: isAdmin,
  });

  if (insertErr) {
    console.error("[comments] insert failed", insertErr);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }

  // 관리자 본인 댓글은 알림 스킵, 일반 사용자 댓글은 운영자에게 알림
  if (!isAdmin) {
    const { data: authorAuth } = await serviceSupabase.auth.admin.getUserById(
      user.id
    );
    const authorEmail = authorAuth?.user?.email ?? "(unknown)";
    const url = `https://iiiahalab.com/openlab/${post_id}`;
    const preview =
      trimmed.length > 600 ? trimmed.slice(0, 600) + "…" : trimmed;
    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.7; color: #111;">
  <h2 style="font-size: 16px; margin: 0 0 16px;">[오픈랩 댓글] ${escapeHtml(post.title)}</h2>
  <table style="border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">댓글 작성자</td><td>${escapeHtml(authorEmail)}</td></tr>
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">게시글</td><td>${escapeHtml(post.title)}</td></tr>
  </table>
  <pre style="font-family: inherit; white-space: pre-wrap; background: #fafafa; border: 1px solid #eee; padding: 12px; font-size: 13px; margin: 0 0 16px;">${escapeHtml(preview)}</pre>
  <p><a href="${url}" style="color:#111; font-weight: bold;">→ 글 보기</a></p>
</div>
    `.trim();
    // 메일 발송 실패는 댓글 성공 응답을 막지 않음
    sendOperatorMail(`[오픈랩 댓글] ${post.title}`, html).catch(() => {});
  }

  return NextResponse.json({ status: "posted" });
}
