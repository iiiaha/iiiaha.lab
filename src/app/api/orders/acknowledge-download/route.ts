import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { order_id } = (await req.json()) as { order_id: string };
  if (!order_id) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  }

  // 본인 주문인지 확인
  const { data: order } = await serviceSupabase
    .from("orders")
    .select("id, user_id, download_acknowledged_at, subscription_id, payment_key")
    .eq("id", order_id)
    .maybeSingle();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // 구독/관리자 발급 주문은 다운로드 acknowledge 추적 안 함 (환불 대상 아님)
  if (order.subscription_id || order.payment_key?.startsWith("admin")) {
    return NextResponse.json({ status: "skipped" });
  }

  // 이미 표시됐으면 그대로
  if (order.download_acknowledged_at) {
    return NextResponse.json({ status: "already_acknowledged" });
  }

  await serviceSupabase
    .from("orders")
    .update({ download_acknowledged_at: new Date().toISOString() })
    .eq("id", order.id);

  return NextResponse.json({ status: "acknowledged" });
}
