import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .single();
  return admin ? user : null;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // 자기 자신 삭제 금지
  if (user_id === admin.id) {
    return NextResponse.json(
      { error: "자기 자신은 삭제할 수 없습니다" },
      { status: 400 }
    );
  }

  // 다른 관리자 삭제 금지
  const { data: targetAdmin } = await serviceSupabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user_id)
    .maybeSingle();
  if (targetAdmin) {
    return NextResponse.json(
      { error: "다른 관리자 계정은 삭제할 수 없습니다" },
      { status: 403 }
    );
  }

  // FK 정책이 알아서 처리:
  // - licenses / subscriptions / course_progress / admins → CASCADE (삭제됨)
  // - orders / comments / posts / bug_reports → SET NULL (영수증·UGC 익명 보존)
  // coupon_uses는 FK 없으니 수동 정리 (orphan 정리 차원).
  await serviceSupabase.from("coupon_uses").delete().eq("user_id", user_id);

  const { error } = await serviceSupabase.auth.admin.deleteUser(user_id);
  if (error) {
    console.error("[admin/users/delete] deleteUser failed", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "deleted", user_id });
}
