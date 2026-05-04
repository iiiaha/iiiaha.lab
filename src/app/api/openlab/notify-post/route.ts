import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";
import { sendOperatorMail, escapeHtml } from "@/lib/alert";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CATEGORY_LABEL: Record<string, string> = {
  idea: "Idea",
  bug: "Q&A",
  notice: "Notice",
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(
    limiters.openlabNotify,
    getClientId(req, user.id)
  );
  if (limited) return limited;

  const { post_id } = (await req.json()) as { post_id: string };
  if (!post_id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: post } = await serviceSupabase
    .from("posts")
    .select(
      "id, user_id, category, title, description, os, sketchup_version, autocad_version, created_at, products(name)"
    )
    .eq("id", post_id)
    .maybeSingle();
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // 호출자가 글 작성자가 아니면 메일 트리거 불가 (스팸 방지)
  if (post.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 작성자가 관리자면 본인 알림 스킵
  const { data: adminRow } = await serviceSupabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminRow) {
    return NextResponse.json({ status: "skipped-admin" });
  }

  const { data: authorAuth } = await serviceSupabase.auth.admin.getUserById(
    user.id
  );
  const authorEmail = authorAuth?.user?.email ?? "(unknown)";

  const productsRel = post.products as
    | { name: string }
    | { name: string }[]
    | null;
  const productName = Array.isArray(productsRel)
    ? productsRel[0]?.name ?? "—"
    : productsRel?.name ?? "—";
  const categoryLabel = CATEGORY_LABEL[post.category] ?? post.category;
  const url = `https://iiiahalab.com/openlab/${post.id}`;
  const description = post.description ?? "";
  const preview =
    description.length > 600 ? description.slice(0, 600) + "…" : description;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.7; color: #111;">
  <h2 style="font-size: 16px; margin: 0 0 16px;">[오픈랩] ${escapeHtml(categoryLabel)} · ${escapeHtml(post.title)}</h2>
  <table style="border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">작성자</td><td>${escapeHtml(authorEmail)}</td></tr>
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">카테고리</td><td>${escapeHtml(categoryLabel)}</td></tr>
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">관련 익스텐션</td><td>${escapeHtml(productName)}</td></tr>
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">운영체제</td><td>${escapeHtml(post.os ?? "—")}</td></tr>
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">SketchUp</td><td>${escapeHtml(post.sketchup_version ?? "—")}</td></tr>
    <tr><td style="color:#666; padding: 2px 12px 2px 0;">AutoCAD</td><td>${escapeHtml(post.autocad_version ?? "—")}</td></tr>
  </table>
  <pre style="font-family: inherit; white-space: pre-wrap; background: #fafafa; border: 1px solid #eee; padding: 12px; font-size: 13px; margin: 0 0 16px;">${escapeHtml(preview)}</pre>
  <p><a href="${url}" style="color:#111; font-weight: bold;">→ 글 보기</a></p>
</div>
  `.trim();

  await sendOperatorMail(
    `[오픈랩] ${categoryLabel} · ${post.title}`,
    html
  );

  return NextResponse.json({ status: "sent" });
}
