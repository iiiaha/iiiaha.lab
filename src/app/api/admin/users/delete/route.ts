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

  // 관련 데이터 명시적 정리 (FK 캐스케이드에 의존하지 않음)
  await serviceSupabase.from("licenses").delete().eq("user_id", user_id);
  await serviceSupabase.from("orders").delete().eq("user_id", user_id);
  await serviceSupabase.from("subscriptions").delete().eq("user_id", user_id);
  await serviceSupabase.from("coupon_uses").delete().eq("user_id", user_id);

  // auth.users에서 제거 (이게 마지막)
  const { error } = await serviceSupabase.auth.admin.deleteUser(user_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "deleted", user_id });
}
