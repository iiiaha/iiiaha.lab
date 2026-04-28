import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("id");
  const full = req.nextUrl.searchParams.get("full") === "true";
  if (!userId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // 인증 필수 (PII 누출 방지)
  const supabase = await createServerSupabase();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(limiters.userEmail, getClientId(req, caller.id));
  if (limited) return limited;

  // full=true는 admin이거나 본인 자신일 때만 허용
  if (full && caller.id !== userId) {
    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await serviceSupabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    return NextResponse.json({ email: null });
  }

  const email = data.user.email;

  if (full) {
    return NextResponse.json({ name: email });
  }

  // 마스킹 (일반 사용자용)
  const id = email.split("@")[0];
  let masked: string;
  if (id.length <= 2) {
    masked = id[0] + "*";
  } else if (id.length <= 4) {
    masked = id[0] + "*".repeat(id.length - 2) + id[id.length - 1];
  } else {
    masked = id.slice(0, 2) + "*".repeat(id.length - 4) + id.slice(-2);
  }

  return NextResponse.json({ name: masked });
}
