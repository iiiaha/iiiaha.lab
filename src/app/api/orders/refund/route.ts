import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

  const { data: order } = await serviceSupabase
    .from("orders")
    .select(
      "id, user_id, status, amount, payment_key, subscription_id, created_at, download_acknowledged_at, products(name)"
    )
    .eq("id", order_id)
    .maybeSingle();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "결제완료 상태의 주문만 환불할 수 있습니다" },
      { status: 400 }
    );
  }

  if (order.subscription_id || order.payment_key?.startsWith("admin")) {
    return NextResponse.json(
      { error: "이 주문은 자가 환불 대상이 아닙니다" },
      { status: 400 }
    );
  }

  if (!order.amount || order.amount <= 0) {
    return NextResponse.json(
      { error: "환불할 금액이 없습니다" },
      { status: 400 }
    );
  }

  // 7일 윈도우
  const ageMs = Date.now() - new Date(order.created_at).getTime();
  if (ageMs > REFUND_WINDOW_MS) {
    return NextResponse.json(
      { error: "환불 가능 기간(7일)이 지났습니다" },
      { status: 400 }
    );
  }

  // 다운로드 이력
  if (order.download_acknowledged_at) {
    return NextResponse.json(
      {
        error:
          "이미 다운로드하신 상품은 환불할 수 없습니다. 문제가 있다면 contact@iiiahalab.com으로 문의해 주세요.",
      },
      { status: 400 }
    );
  }

  const paymentKey = order.payment_key;
  if (!paymentKey) {
    return NextResponse.json(
      { error: "결제 정보를 찾을 수 없습니다" },
      { status: 400 }
    );
  }

  if (!process.env.TOSS_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 }
    );
  }

  // 토스 부분 환불 (cancelAmount로 이 주문 금액만)
  const tossRes = await fetch(
    `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancelReason: "사용자 자가 환불 (다운로드 전)",
        cancelAmount: order.amount,
      }),
    }
  );

  if (!tossRes.ok) {
    const err = await tossRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.message || "토스 환불 요청에 실패했습니다" },
      { status: 400 }
    );
  }

  await serviceSupabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", order.id);

  const { data: revokedLicenses } = await serviceSupabase
    .from("licenses")
    .update({ status: "revoked" })
    .eq("order_id", order.id)
    .select("id");

  return NextResponse.json({
    status: "refunded",
    refunded_amount: order.amount,
    revoked_licenses: revokedLicenses?.length ?? 0,
  });
}
