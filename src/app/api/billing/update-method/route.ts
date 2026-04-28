import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";
import { sendAlert, formatError } from "@/lib/alert";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Plan = "monthly" | "annual";

function addPeriod(from: Date, plan: Plan): Date {
  const result = new Date(from);
  if (plan === "annual") {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    const expectedMonth = (result.getMonth() + 1) % 12;
    result.setMonth(result.getMonth() + 1);
    if (result.getMonth() !== expectedMonth) {
      result.setDate(0);
    }
  }
  return result;
}

interface UpdateBody {
  authKey: string;
  customerKey: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as UpdateBody;
  const { authKey, customerKey } = body;

  if (!authKey || !customerKey) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(limiters.billingConfirm, getClientId(req, user.id));
  if (limited) return limited;

  if (customerKey !== user.id) {
    return NextResponse.json({ error: "Customer key mismatch" }, { status: 403 });
  }

  // 활성/past_due 구독 조회 — 갱신 대상이 있어야 의미가 있음
  const { data: sub } = await serviceSupabase
    .from("subscriptions")
    .select("id, plan, status, expires_at, amount, customer_key")
    .eq("user_id", user.id)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json(
      { error: "변경할 멤버십이 없습니다" },
      { status: 404 }
    );
  }

  if (!process.env.TOSS_BILLING_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 }
    );
  }

  const tossAuth = `Basic ${Buffer.from(process.env.TOSS_BILLING_SECRET_KEY + ":").toString("base64")}`;

  // authKey → 새 billingKey 교환
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
      { error: err.message || "결제수단 등록에 실패했습니다" },
      { status: 400 }
    );
  }
  const billingData = await issueRes.json();
  const newBillingKey: string = billingData.billingKey;

  // 새 billingKey 저장 (active든 past_due든 동일)
  await serviceSupabase
    .from("subscriptions")
    .update({
      billing_key: newBillingKey,
      customer_key: customerKey,
    })
    .eq("id", sub.id);

  // active이면 여기서 종료 — 다음 결제일에 새 카드로 청구됨
  if (sub.status === "active") {
    return NextResponse.json({
      status: "method_updated",
      retry: false,
    });
  }

  // past_due → 새 카드로 즉시 재시도
  const now = new Date();
  const orderId = `bill_${Date.now()}_${sub.id.slice(0, 8)}`;
  const orderName =
    sub.plan === "annual"
      ? "iiiaha.lab 연간 구독 갱신"
      : "iiiaha.lab 월간 구독 갱신";

  const chargeRes = await fetch(
    `https://api.tosspayments.com/v1/billing/${newBillingKey}`,
    {
      method: "POST",
      headers: { Authorization: tossAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerKey,
        amount: sub.amount,
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
    // 새 카드도 거절 — billing_key는 새 것으로 갱신했으니 cron이 다음날 재시도 가능
    return NextResponse.json(
      {
        error: err.message || "새 결제수단으로도 결제가 거절되었습니다",
        code: err.code,
        retry: true,
        recovered: false,
      },
      { status: 400 }
    );
  }

  const chargeData = await chargeRes.json();
  const paymentKey: string = chargeData.paymentKey;

  // 성공 — past_due → active 복원, expires_at 한 주기 연장
  const nextExpires = addPeriod(new Date(sub.expires_at), sub.plan as Plan);
  const { error: updErr } = await serviceSupabase
    .from("subscriptions")
    .update({
      status: "active",
      expires_at: nextExpires.toISOString(),
      last_payment_key: paymentKey,
      last_charged_at: now.toISOString(),
    })
    .eq("id", sub.id);

  if (updErr) {
    await sendAlert(
      `update-method-recover-fail-${user.id}`,
      "결제수단 변경 후 DB 갱신 실패",
      `Toss 청구는 성공했지만 subscriptions 갱신 실패. 수동 처리 필요.\nuser: ${user.id}\nsub: ${sub.id}\npaymentKey: ${paymentKey}\nerror: ${formatError(updErr)}`
    );
    return NextResponse.json(
      { error: "결제는 됐지만 멤버십 상태 갱신에 실패했습니다. 잠시 후 다시 확인해 주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "recovered",
    retry: true,
    recovered: true,
    expires_at: nextExpires.toISOString(),
  });
}
