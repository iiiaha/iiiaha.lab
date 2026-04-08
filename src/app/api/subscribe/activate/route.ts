import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateLicenseKey } from "@/lib/license-utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { subscription_id } = await req.json();

  if (!subscription_id) {
    return NextResponse.json({ error: "subscription_id is required" }, { status: 400 });
  }

  // 구독 조회
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscription_id)
    .single();

  if (subError || !subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  if (subscription.status !== "active") {
    return NextResponse.json({ error: "Subscription is not active" }, { status: 400 });
  }

  // 모든 활성 익스텐션 조회
  const { data: extensions } = await supabase
    .from("products")
    .select("id")
    .eq("type", "extension")
    .eq("is_active", true);

  if (!extensions || extensions.length === 0) {
    return NextResponse.json({ error: "No extensions found" }, { status: 404 });
  }

  // 이미 구독으로 생성된 라이센스 확인
  const { data: existingOrders } = await supabase
    .from("orders")
    .select("product_id")
    .eq("subscription_id", subscription_id);

  const existingProductIds = new Set(existingOrders?.map((o) => o.product_id) ?? []);

  // 아직 없는 제품에 대해서만 주문+라이센스 생성
  const results = [];
  for (const ext of extensions) {
    if (existingProductIds.has(ext.id)) continue;

    const { data: order } = await supabase
      .from("orders")
      .insert({
        user_id: subscription.user_id,
        product_id: ext.id,
        amount: 0,
        status: "paid",
        payment_key: `subscription:${subscription_id}`,
        subscription_id: subscription_id,
      })
      .select()
      .single();

    if (!order) continue;

    const licenseKey = generateLicenseKey();
    await supabase.from("licenses").insert({
      order_id: order.id,
      user_id: subscription.user_id,
      product_id: ext.id,
      license_key: licenseKey,
      subscription_id: subscription_id,
    });

    results.push({ product_id: ext.id, license_key: licenseKey });
  }

  return NextResponse.json({
    status: "activated",
    created: results.length,
    total_extensions: extensions.length,
  });
}
