import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Plan = "monthly" | "annual";

// 디버그 시즌 (~ 2026-07-31): monthly 24900. 시즌 종료 시 29000으로 환원.
// SubscribeContent.tsx의 MONTHLY_PRICE / ANNUAL_PRICE와 반드시 일치해야 한다.
const PLAN_PRICES: Record<Plan, number> = {
  monthly: 24900,
  annual: 300000,
};

interface ConfirmBody {
  authKey: string;
  customerKey: string;
  plan: Plan;
  amount: number;
}

// JS 기준 end-of-month clamping이 필요한 경우를 처리한다.
function addPeriod(from: Date, plan: Plan): Date {
  const result = new Date(from);
  if (plan === "annual") {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    const expectedMonth = (result.getMonth() + 1) % 12;
    result.setMonth(result.getMonth() + 1);
    if (result.getMonth() !== expectedMonth) {
      result.setDate(0); // 이전 달의 말일로 clamp
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ConfirmBody;
  const { authKey, customerKey, plan, amount } = body;

  if (!authKey || !customerKey || !plan || typeof amount !== "number") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // 1. 인증
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // customerKey는 user.id와 일치해야 함 (변조 방지)
  if (customerKey !== user.id) {
    return NextResponse.json({ error: "Customer key mismatch" }, { status: 403 });
  }

  // amount 서버 측 검증 (클라이언트에서 보낸 값을 그대로 신뢰하지 않음)
  if (amount !== PLAN_PRICES[plan]) {
    return NextResponse.json(
      { error: "Amount mismatch", expected: PLAN_PRICES[plan] },
      { status: 400 }
    );
  }

  // 2. 이미 활성 구독이 있으면 중복 가입 금지
  const { data: existing } = await serviceSupabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "이미 활성 구독이 있습니다" },
      { status: 400 }
    );
  }

  if (!process.env.TOSS_BILLING_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 }
    );
  }

  const tossAuth = `Basic ${Buffer.from(process.env.TOSS_BILLING_SECRET_KEY + ":").toString("base64")}`;

  // 3. authKey → billingKey 교환
  const issueRes = await fetch(
    "https://api.tosspayments.com/v1/billing/authorizations/issue",
    {
      method: "POST",
      headers: { Authorization: tossAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, customerKey }),
    }
  );
  if (!issueRes.ok) {
    const err = await issueRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.message || "빌링 키 발급에 실패했습니다" },
      { status: 400 }
    );
  }
  const billingData = await issueRes.json();
  const billingKey: string = billingData.billingKey;

  // 4. 첫 결제
  const orderId = `bill_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const orderName =
    plan === "annual"
      ? "iiiaha.lab 연간 구독"
      : "iiiaha.lab 월간 구독";

  const chargeRes = await fetch(
    `https://api.tosspayments.com/v1/billing/${billingKey}`,
    {
      method: "POST",
      headers: { Authorization: tossAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerKey,
        amount,
        orderId,
        orderName,
        customerEmail: user.email,
        customerName:
          (user.user_metadata as { full_name?: string } | null)?.full_name ??
          user.email?.split("@")[0],
      }),
    }
  );

  if (!chargeRes.ok) {
    const err = await chargeRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.message || "첫 결제에 실패했습니다" },
      { status: 400 }
    );
  }
  const chargeData = await chargeRes.json();
  const paymentKey: string = chargeData.paymentKey;

  // 5. 구독 레코드 생성
  const now = new Date();
  const expiresAt = addPeriod(now, plan);

  const { data: subscription, error: subErr } = await serviceSupabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan,
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      billing_key: billingKey,
      customer_key: customerKey,
      amount,
      last_payment_key: paymentKey,
      last_charged_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (subErr || !subscription) {
    return NextResponse.json(
      { error: "구독 저장에 실패했습니다", detail: subErr?.message },
      { status: 500 }
    );
  }

  // 6. 기존 revoked 멤버십 라이선스 복구 (재구독 시)
  await serviceSupabase
    .from("licenses")
    .update({ status: "active", hwid: null, activated_at: null })
    .eq("user_id", user.id)
    .eq("status", "revoked")
    .not("subscription_id", "is", null);

  // 복구된 라이선스의 subscription_id를 새 구독으로 갱신
  await serviceSupabase
    .from("licenses")
    .update({ subscription_id: subscription.id })
    .eq("user_id", user.id)
    .eq("status", "active")
    .not("subscription_id", "is", null);

  return NextResponse.json({
    status: "success",
    subscription_id: subscription.id,
    expires_at: expiresAt.toISOString(),
  });
}
