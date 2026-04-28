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

// 결제 실패 후 자동 재시도 기간. expires_at이 graceCutoff보다 오래된 past_due는 expired 처리.
const GRACE_DAYS = 3;

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
  const graceCutoff = new Date(now);
  graceCutoff.setDate(graceCutoff.getDate() - GRACE_DAYS);

  // 청구 대상: 만료 도달한 active + 그레이스 기간 내 past_due (재시도)
  const { data: subs, error: subsErr } = await serviceSupabase
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "past_due"])
    .lte("expires_at", now.toISOString())
    .gte("expires_at", graceCutoff.toISOString());

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

    const wasPastDue = sub.status === "past_due";

    if (!chargeRes.ok) {
      const err = await chargeRes.json().catch(() => ({}));

      // active → past_due 전이 시에만 사용자 메일 발송 (그레이스 기간 중 매일 스팸 방지)
      if (!wasPastDue) {
        await serviceSupabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("id", sub.id);

        try {
          const { data: authUser } =
            await serviceSupabase.auth.admin.getUserById(sub.user_id);
          if (authUser?.user?.email) {
            const reason: string = err?.message || "카드사로부터 거절되었습니다.";
            const code: string | undefined = err?.code;
            const planLabel = sub.plan === "annual" ? "연간" : "월간";

            await resend.emails.send({
              from: "iiiaha.lab <noreply@iiiahalab.com>",
              to: authUser.user.email,
              subject: "[iiiaha.lab] 멤버십 자동결제가 실패했습니다",
              html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:560px">
<p>안녕하세요,</p>
<p>iiiaha.lab <b>${planLabel} 멤버십</b> 자동결제가 카드사에서 거절되어 안내드립니다.</p>

<p style="background:#f5f5f5;padding:12px 14px;border-left:3px solid #c00;margin:16px 0">
<b style="color:#c00">결제 거절 사유</b><br>
${reason}${code ? ` <span style="color:#999;font-size:12px">(${code})</span>` : ""}
</p>

<p style="background:#fff8e1;padding:12px 14px;border-left:3px solid #f0a800;margin:16px 0">
앞으로 <b>${GRACE_DAYS}일간</b> 매일 자동 재시도가 진행됩니다. 그 사이 결제수단을 변경하시면 즉시 결제가 진행되어 멤버십이 정상 유지됩니다.<br>
${GRACE_DAYS}일이 지나도록 결제가 성공하지 못하면 멤버십이 자동으로 만료됩니다.
</p>

<p><b>가능한 원인</b></p>
<ul style="padding-left:20px;margin:6px 0">
  <li>카드 한도 초과 또는 잔액 부족</li>
  <li>카드 정지·분실 신고·유효기간 만료</li>
  <li>카드사 일시 점검</li>
</ul>

<p><b>조치 방법</b></p>
<ol style="padding-left:20px;margin:6px 0">
  <li>카드사에 문의하여 결제 가능 여부를 확인해 주세요.</li>
  <li>다른 카드로 바꾸시려면 <a href="https://iiiahalab.com/mypage" style="color:#111">마이페이지</a> → <b>결제수단 변경</b>을 이용해 주세요. 변경과 동시에 결제가 즉시 시도됩니다.</li>
</ol>

<p style="color:#666;font-size:13px">기타 문의: <a href="mailto:contact@iiiahalab.com" style="color:#111">contact@iiiahalab.com</a></p>

<p style="color:#999;font-size:12px;margin-top:24px">— iiiaha.lab</p>
</div>`,
            });
          }
        } catch {
          // 이메일 발송 실패는 cron 전체를 중단시키지 않음
        }
      }

      await sendAlert(
        `cron-charge-fail-${sub.id}-${wasPastDue ? "retry" : "first"}`,
        wasPastDue ? "멤버십 자동결제 재시도 실패" : "멤버십 자동결제 실패",
        `cron이 멤버십 갱신 청구를 시도했으나 Toss 거부. ${wasPastDue ? "그레이스 기간 중 재시도 실패." : "첫 실패 — 안내 메일 발송됨."} 사용자 ${sub.user_id}, plan ${sub.plan}, amount ${sub.amount}, error: ${err.message || "(no message)"}`
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

    // 청구 성공 → 다음 기간으로 연장 + past_due였다면 active로 복원
    const nextExpires = addPeriod(new Date(sub.expires_at), sub.plan);
    await serviceSupabase
      .from("subscriptions")
      .update({
        status: "active",
        expires_at: nextExpires.toISOString(),
        last_payment_key: paymentKey,
        last_charged_at: now.toISOString(),
      })
      .eq("id", sub.id);

    results.push({
      id: sub.id,
      result: "charged",
      detail: wasPastDue ? "recovered from past_due" : undefined,
    });
  }

  // 그레이스 기간 만료된 past_due → expired + 라이선스 revoke
  // expires_at < graceCutoff 인 것만. (graceCutoff = now - GRACE_DAYS, 같은 cron 실행에서 재시도 대상은 expires_at >= graceCutoff)
  const { data: pastDueSubs } = await serviceSupabase
    .from("subscriptions")
    .select("id")
    .eq("status", "past_due")
    .lt("expires_at", graceCutoff.toISOString());

  for (const sub of pastDueSubs ?? []) {
    await serviceSupabase
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", sub.id);

    await serviceSupabase
      .from("licenses")
      .update({ status: "revoked" })
      .eq("subscription_id", sub.id);

    results.push({ id: sub.id, result: "expired", detail: "grace expired" });
  }

  return NextResponse.json({ processed: results.length, results });
}
