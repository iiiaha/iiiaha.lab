import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
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

  const { user_id, plan } = (await req.json()) as {
    user_id: string;
    plan: Plan;
  };

  if (!user_id || (plan !== "monthly" && plan !== "annual")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // 이미 활성 구독이 있으면 거부
  const { data: existing } = await serviceSupabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user_id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "이미 활성 구독이 있습니다" },
      { status: 400 }
    );
  }

  const now = new Date();
  const expiresAt = addPeriod(now, plan);

  // 구독 레코드 생성 (billing_key/amount 없음 — 관리자 무상 발급)
  const { data: subscription, error: subErr } = await serviceSupabase
    .from("subscriptions")
    .insert({
      user_id,
      plan,
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      billing_key: null,
      customer_key: null,
      amount: 0,
    })
    .select("id")
    .single();

  if (subErr || !subscription) {
    return NextResponse.json(
      { error: subErr?.message || "Failed to create subscription" },
      { status: 500 }
    );
  }

  // 모든 활성 익스텐션 fan-out
  const { data: extensions } = await serviceSupabase
    .from("products")
    .select("id")
    .eq("type", "extension")
    .eq("is_active", true);

  let granted = 0;
  for (const ext of extensions ?? []) {
    const { data: order } = await serviceSupabase
      .from("orders")
      .insert({
        user_id,
        product_id: ext.id,
        amount: 0,
        status: "paid",
        payment_key: `admin-comp:${subscription.id}`,
        subscription_id: subscription.id,
      })
      .select("id")
      .single();
    if (!order) continue;
    await serviceSupabase.from("licenses").insert({
      order_id: order.id,
      user_id,
      product_id: ext.id,
      license_key: generateLicenseKey(),
      subscription_id: subscription.id,
    });
    granted++;
  }

  return NextResponse.json({
    status: "granted",
    subscription_id: subscription.id,
    plan,
    expires_at: expiresAt.toISOString(),
    licenses_granted: granted,
  });
}
