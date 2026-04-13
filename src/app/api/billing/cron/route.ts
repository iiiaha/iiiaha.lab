import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateLicenseKey } from "@/lib/license-utils";

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
  // Vercel Cron과 수동 호출 모두 허용 (CRON_SECRET으로 보호)
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.TOSS_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 }
    );
  }

  const tossAuth = `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`;
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
      results.push({ id: sub.id, result: "expired" });
      continue;
    }

    // 관리자 무상 구독(billing_key 없음) → 만료 시점에 자동 만료
    if (!sub.billing_key || !sub.customer_key || !sub.amount) {
      await serviceSupabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);
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
      // 실패: past_due로 마킹 (추후 재시도 또는 수동 해결)
      await serviceSupabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", sub.id);
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

    // 신규 출시된 익스텐션이 있으면 자동 fan-out
    const { data: allExtensions } = await serviceSupabase
      .from("products")
      .select("id")
      .eq("type", "extension")
      .eq("is_active", true);

    const { data: existingOrders } = await serviceSupabase
      .from("orders")
      .select("product_id")
      .eq("subscription_id", sub.id);

    const existingSet = new Set(
      (existingOrders ?? []).map((o) => o.product_id)
    );

    for (const ext of allExtensions ?? []) {
      if (existingSet.has(ext.id)) continue;
      const { data: order } = await serviceSupabase
        .from("orders")
        .insert({
          user_id: sub.user_id,
          product_id: ext.id,
          amount: 0,
          status: "paid",
          payment_key: `subscription:${sub.id}`,
          subscription_id: sub.id,
        })
        .select("id")
        .single();
      if (!order) continue;
      await serviceSupabase.from("licenses").insert({
        order_id: order.id,
        user_id: sub.user_id,
        product_id: ext.id,
        license_key: generateLicenseKey(),
        subscription_id: sub.id,
      });
    }

    results.push({ id: sub.id, result: "charged" });
  }

  return NextResponse.json({ processed: results.length, results });
}
