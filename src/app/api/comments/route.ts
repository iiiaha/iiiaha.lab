import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";

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

  // 게시글 존재 확인 (orphan 댓글 방지)
  const { data: post } = await serviceSupabase
    .from("posts")
    .select("id")
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

  return NextResponse.json({ status: "posted" });
}
