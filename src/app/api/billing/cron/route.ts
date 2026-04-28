import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";
import { sendAlert } from "@/lib/alert";

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const resend = new Resend(process.env.RESEND_API_KEY);

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

interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: string;
  expires_at: string;
  billing_key: string | null;
  customer_key: string | null;
  amount: number | null;
  cancel_at_period_end: boolean;
}

export async function GET(req: NextRequest) {
  // Vercel Cron과 수동 호출 모두 허용 (CRON_SECRET으로 보호, timing-safe 비교)
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || !auth || !timingSafeStringEqual(auth, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.TOSS_BILLING_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 }
    );
  }

  const tossAuth = `Basic ${Buffer.from(process.env.TOSS_BILLING_SECRET_KEY + ":").toString("base64")}`;
  const now = new Date();

  // 오늘까지 만료되는 활성 구독 조회
  const { data: subs, error: subsErr } = await serviceSupabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("expires_at", now.toISOString());

  if (subsErr) {
    return NextResponse.json({ error: subsErr.message }, { status: 500 });
  }

  const results: {
    id: string;
    result: "charged" | "expired" | "failed" | "skipped";
    detail?: string;
  }[] = [];

  for (const sub of (subs ?? []) as Subscription[]) {
    // 해지 예약된 경우 → 바로 만료 처리
    if (sub.cancel_at_period_end) {
      await serviceSupabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);

      // 구독 라이선스 일괄 revoke
      await serviceSupabase
        .from("licenses")
        .update({ status: "revoked" })
        .eq("subscription_id", sub.id);

      results.push({ id: sub.id, result: "expired" });
      continue;
    }

    // 관리자 무상 구독(billing_key 없음) → 만료 시점에 자동 만료
    if (!sub.billing_key || !sub.customer_key || !sub.amount) {
      await serviceSupabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);

      // 구독 라이선스 일괄 revoke
      await serviceSupabase
        .from("licenses")
        .update({ status: "revoked" })
        .eq("subscription_id", sub.id);

      results.push({ id: sub.id, result: "expired", detail: "comp subscription" });
      continue;
    }

    const orderId = `bill_${Date.now()}_${sub.id.slice(0, 8)}`;
    const orderName =
      sub.plan === "annual"
        ? "iiiaha.lab 연간 구독 갱신"
        : "iiiaha.lab 월간 구독 갱신";

    const chargeRes = await fetch(
      `https://api.tosspayments.com/v1/billing/${sub.billing_key}`,
      {
        method: "POST",
        headers: { Authorization: tossAuth, "Content-Type": "application/json" },
        body: JSON.stringify({
          customerKey: sub.customer_key,
          amount: sub.amount,
          orderId,
          orderName,
        }),
      }
    );

    if (!chargeRes.ok) {
      const err = await chargeRes.json().catch(() => ({}));
      // 실패: past_due로 마킹
      await serviceSupabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", sub.id);

      // 결제 실패 이메일 알림
      try {
        const { data: authUser } =
          await serviceSupabase.auth.admin.getUserById(sub.user_id);
        if (authUser?.user?.email) {
          await resend.emails.send({
            from: "iiiaha.lab <noreply@iiiahalab.com>",
            to: authUser.user.email,
            subject: "Payment failed — iiiaha.lab membership",
            html: `<p>Hi,</p>
<p>We were unable to process your membership renewal payment.</p>
<p>Please update your payment method at <a href="https://iiiahalab.com/mypage">your account page</a> to continue using your extensions.</p>
<p>— iiiaha.lab</p>`,
          });
        }
      } catch {
        // 이메일 발송 실패는 cron 전체를 중단시키지 않음
      }

      await sendAlert(
        `cron-charge-fail-${sub.id}`,
        "멤버십 자동결제 실패",
        `cron이 멤버십 갱신 청구를 시도했으나 Toss 거부. 사용자에겐 결제수단 변경 안내 메일 발송됨. 사용자 ${sub.user_id}, plan ${sub.plan}, amount ${sub.amount}, error: ${err.message || "(no message)"}`
      );

      results.push({
        id: sub.id,
        result: "failed",
        detail: err.message || "charge failed",
      });
      continue;
    }

    const chargeData = await chargeRes.json();
    const paymentKey: string = chargeData.paymentKey;

    // 다음 기간으로 연장
    const nextExpires = addPeriod(new Date(sub.expires_at), sub.plan);
    await serviceSupabase
      .from("subscriptions")
      .update({
        expires_at: nextExpires.toISOString(),
        last_payment_key: paymentKey,
        last_charged_at: now.toISOString(),
      })
      .eq("id", sub.id);

    results.push({ id: sub.id, result: "charged" });
  }

  // past_due 구독 중 만료일이 지난 것 → expired + 라이선스 revoke
  const { data: pastDueSubs } = await serviceSupabase
    .from("subscriptions")
    .select("id")
    .eq("status", "past_due")
    .lte("expires_at", now.toISOString());

  for (const sub of pastDueSubs ?? []) {
    await serviceSupabase
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", sub.id);

    await serviceSupabase
      .from("licenses")
      .update({ status: "revoked" })
      .eq("subscription_id", sub.id);

    results.push({ id: sub.id, result: "expired", detail: "past_due expired" });
  }

  return NextResponse.json({ processed: results.length, results });
}
