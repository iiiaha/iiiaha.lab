import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_CONTENT_LENGTH = 2000;

async function fetchComment(id: string) {
  const { data } = await serviceSupabase
    .from("comments")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  return data as { id: string; user_id: string | null } | null;
}

async function isAdminUser(userId: string) {
  const { data } = await serviceSupabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(limiters.comments, getClientId(req, user.id));
  if (limited) return limited;

  const comment = await fetchComment(id);
  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // 수정은 작성자 본인만. 어드민이라도 남의 댓글 내용은 못 바꾼다.
  if (comment.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content } = (await req.json()) as { content?: string };
  const trimmed = (content ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content too long (max ${MAX_CONTENT_LENGTH} chars)` },
      { status: 400 }
    );
  }

  const { error } = await serviceSupabase
    .from("comments")
    .update({ content: trimmed, is_edited: true })
    .eq("id", id);

  if (error) {
    console.error("[comments] update failed", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
  return NextResponse.json({ status: "updated" });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const comment = await fetchComment(id);
  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 삭제는 작성자 본인 또는 어드민.
  const isOwner = comment.user_id === user.id;
  const allowed = isOwner || (await isAdminUser(user.id));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await serviceSupabase
    .from("comments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[comments] delete failed", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
  return NextResponse.json({ status: "deleted" });
}
