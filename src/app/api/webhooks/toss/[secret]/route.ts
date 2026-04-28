import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 토스 웹훅 수신 라우트.
// 공식 스펙:
// - 결제/빌링 이벤트엔 서명 헤더가 없음 → URL path secret으로 1차 인증
// - body를 직접 신뢰하지 않고 Toss API로 재조회하여 진실 확정
// - 10초 내 200 응답 필수, 아니면 재시도 (최대 7회, 누적 ~3일 19시간)
// - 핸들러는 idempotent 필수 — 중복 호출되어도 DB 상태가 같아야 함.
//
// 등록 URL: https://iiiahalab.com/api/webhooks/toss/{TOSS_WEBHOOK_SECRET}
// 구독 이벤트: PAYMENT_STATUS_CHANGED, BILLING_DELETED
// 단건 MID / 정기(billing) MID 각각에 동일 URL 등록.

type TossPaymentStatus =
  | "READY"
  | "IN_PROGRESS"
  | "WAITING_FOR_DEPOSIT"
  | "DONE"
  | "CANCELED"
  | "PARTIAL_CANCELED"
  | "ABORTED"
  | "EXPIRED";

interface TossCancel {
  cancelAmount: number;
  cancelReason?: string;
  canceledAt?: string;
  transactionKey?: string;
}

interface TossPaymentData {
  paymentKey: string;
  orderId: string;
  status: TossPaymentStatus;
  totalAmount: number;
  balanceAmount: number;
  cancels?: TossCancel[];
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  // secret 검증 전 rate limit. 잘못된 secret 추측 시도 자체를 throttle.
  const limited = await rateLimit(limiters.webhook, getClientId(req));
  if (limited) return limited;

  const { secret } = await params;
  const expected = process.env.TOSS_WEBHOOK_SECRET;
  if (!expected || !safeEqual(secret, expected)) {
    // URL을 모르는 호출은 단순 404로 — 존재 자체를 숨김
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let event: {
    eventType?: string;
    createdAt?: string;
    data?: TossPaymentData;
    billingKey?: string;
  };
  try {
    event = await req.json();
  } catch {
    // 파싱 실패 — 빠르게 200으로 ACK해서 재시도 루프는 피하고 로그만
    console.error("[toss webhook] invalid JSON");
    return NextResponse.json({ ok: true });
  }

  try {
    if (event.eventType === "PAYMENT_STATUS_CHANGED" && event.data) {
      await handlePaymentStatusChanged(event.data);
    } else if (event.eventType === "BILLING_DELETED" && event.billingKey) {
      await handleBillingDeleted(event.billingKey);
    }
    // 다른 이벤트는 무시 (구독 안 한 이벤트지만 들어올 수도)
  } catch (err) {
    // 처리 실패해도 200으로 받되 로그 남기기 (재시도 받을지 여부는 정책 판단)
    console.error("[toss webhook] processing error", err);
  }

  return NextResponse.json({ ok: true });
}

async function handlePaymentStatusChanged(data: TossPaymentData) {
  // 취소 외엔 처리 대상 아님
  if (data.status !== "CANCELED" && data.status !== "PARTIAL_CANCELED") {
    return;
  }

  const paymentKey = data.paymentKey;
  if (!paymentKey) return;

  // 1. 토스 API 재조회 — webhook body를 맹신하지 않고 진실 확정
  // 단건 시크릿이 단건 paymentKey를 검증하므로 기본은 단건 키.
  // 단건 키로 실패하면(권한 오류 또는 not found) 빌링 키로도 시도.
  const verified = await fetchPaymentFromToss(paymentKey);
  if (!verified) {
    console.error("[toss webhook] could not verify payment", paymentKey);
    return;
  }

  // 2. 이 paymentKey로 생성된 주문 조회
  const { data: orders } = await serviceSupabase
    .from("orders")
    .select("id, amount, status")
    .eq("payment_key", paymentKey);

  if (!orders || orders.length === 0) {
    // 우리가 모르는 결제 — 타 시스템의 웹훅이거나 DB 정합성 문제
    return;
  }

  // 3. cancels[]를 순회하며 매칭되는 주문을 refunded로 전환 (금액 일치 + 아직 paid인 것)
  const cancels = verified.cancels ?? [];
  const stillPaid = orders.filter((o) => o.status === "paid");

  for (const cancel of cancels) {
    const match = stillPaid.find(
      (o) => o.amount === cancel.cancelAmount && o.status === "paid"
    );
    if (match) {
      await markOrderRefunded(match.id);
      match.status = "refunded"; // 같은 요청 내 중복 매칭 방지
    }
  }

  // 전액 취소(CANCELED)이고 아직 paid가 남아 있다면 — 금액 매칭 실패한 잔여 주문도 refunded로
  // (다건 카트에서 개별 금액이 우연히 같거나, 할인 분배로 살짝 어긋난 경우 대비)
  if (verified.status === "CANCELED") {
    const leftover = orders.filter((o) => o.status === "paid");
    for (const o of leftover) {
      await markOrderRefunded(o.id);
    }
  }
}

async function markOrderRefunded(orderId: string) {
  await serviceSupabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", orderId);

  // 환불은 종결 상태라 라이선스 row 삭제. 감사는 orders.status='refunded'로 남음.
  await serviceSupabase
    .from("licenses")
    .delete()
    .eq("order_id", orderId);
}

async function handleBillingDeleted(billingKey: string) {
  // 외부에서 빌링키가 폐기됨 — 해당 구독을 만료 처리
  const { data: subs } = await serviceSupabase
    .from("subscriptions")
    .select("id, status")
    .eq("billing_key", billingKey)
    .in("status", ["active", "past_due"]);

  if (!subs || subs.length === 0) return;

  for (const sub of subs) {
    await serviceSupabase
      .from("subscriptions")
      .update({
        status: "expired",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    // 해당 구독의 라이선스 revoke
    await serviceSupabase
      .from("licenses")
      .update({ status: "revoked" })
      .eq("subscription_id", sub.id)
      .eq("status", "active");
  }
}

async function fetchPaymentFromToss(
  paymentKey: string
): Promise<TossPaymentData | null> {
  const keys: string[] = [];
  if (process.env.TOSS_SECRET_KEY) keys.push(process.env.TOSS_SECRET_KEY);
  if (process.env.TOSS_BILLING_SECRET_KEY)
    keys.push(process.env.TOSS_BILLING_SECRET_KEY);

  for (const key of keys) {
    const auth = `Basic ${Buffer.from(key + ":").toString("base64")}`;
    const res = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`,
      {
        method: "GET",
        headers: { Authorization: auth },
      }
    );
    if (res.ok) {
      return (await res.json()) as TossPaymentData;
    }
    // 403/404 계열이면 다른 MID 키로 재시도
  }
  return null;
}
