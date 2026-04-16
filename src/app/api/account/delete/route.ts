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

  // 1. 활성 구독 만료 처리
  await serviceSupabase
    .from("subscriptions")
    .update({ status: "expired", canceled_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("status", ["active", "past_due"]);

  // 2. 모든 라이선스 revoke
  await serviceSupabase
    .from("licenses")
    .update({ status: "revoked" })
    .eq("user_id", user.id);

  // 3. 유저 삭제 (auth.users에서 제거)
  const { error } = await serviceSupabase.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "deleted" });
}
