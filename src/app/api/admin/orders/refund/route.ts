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

  const { order_id, reason } = (await req.json()) as {
    order_id: string;
    reason?: string;
  };
  if (!order_id) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  }

  const { data: order } = await serviceSupabase
    .from("orders")
    .select("id, status, amount, payment_key, subscription_id")
    .eq("id", order_id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "결제완료 상태의 주문만 환불할 수 있습니다" },
      { status: 400 }
    );
  }

  const paymentKey = order.payment_key;
  const isTossPayment =
    !!paymentKey &&
    !paymentKey.startsWith("admin") &&
    !paymentKey.startsWith("subscription:") &&
    order.amount > 0;

  if (order.subscription_id) {
    return NextResponse.json(
      {
        error:
          "구독으로 발급된 주문은 개별 환불할 수 없습니다. 구독 해지를 이용해 주세요.",
      },
      { status: 400 }
    );
  }

  // 토스 환불 호출 (실제 결제된 단건 구매만)
  if (isTossPayment) {
    if (!process.env.TOSS_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 500 }
      );
    }

    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancelReason: reason || "관리자 환불",
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
  }

  // 주문 상태 업데이트
  await serviceSupabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", order.id);

  // 환불은 종결 상태라 라이선스 row 삭제. 감사는 orders.status='refunded'로 남음.
  const { data: deletedLicenses } = await serviceSupabase
    .from("licenses")
    .delete()
    .eq("order_id", order.id)
    .select("id");

  return NextResponse.json({
    status: "refunded",
    refunded_amount: isTossPayment ? order.amount : 0,
    deleted_licenses: deletedLicenses?.length ?? 0,
  });
}
