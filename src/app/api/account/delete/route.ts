import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 관리자는 탈퇴 불가
  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (admin) {
    return NextResponse.json(
      { error: "Admin accounts cannot be deleted" },
      { status: 403 }
    );
  }

  // FK 정책이 알아서 처리:
  // - licenses / subscriptions / course_progress → CASCADE (삭제됨)
  // - orders / comments / posts / bug_reports → SET NULL (영수증·UGC 익명 보존)
  // 활성 구독의 Toss billing key는 우리 DB에서만 삭제됨.
  // Toss 측 키는 orphan으로 남지만 우리 cron이 안 돌리니 추가 청구 불가.
  const { error } = await serviceSupabase.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("[account/delete] deleteUser failed", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "deleted" });
}
