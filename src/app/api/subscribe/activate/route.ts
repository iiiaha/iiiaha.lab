import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { generateLicenseKey } from "@/lib/license-utils";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 본인의 활성 구독을 서버에서 조회. subscription_id를 클라이언트에서 받지 않는다.
  const { data: subscription } = await serviceSupabase
    .from("subscriptions")
    .select("id, user_id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json(
      { error: "Active subscription not found" },
      { status: 404 }
    );
  }

  // 모든 활성 익스텐션 조회
  const { data: extensions } = await serviceSupabase
    .from("products")
    .select("id")
    .eq("type", "extension")
    .eq("is_active", true);

  if (!extensions || extensions.length === 0) {
    return NextResponse.json({ error: "No extensions found" }, { status: 404 });
  }

  // 이미 이 구독으로 생성된 라이선스 확인
  const { data: existingOrders } = await serviceSupabase
    .from("orders")
    .select("product_id")
    .eq("subscription_id", subscription.id);

  const existingProductIds = new Set(
    existingOrders?.map((o) => o.product_id) ?? []
  );

  const results: { product_id: string; license_key: string }[] = [];
  for (const ext of extensions) {
    if (existingProductIds.has(ext.id)) continue;

    const { data: order } = await serviceSupabase
      .from("orders")
      .insert({
        user_id: subscription.user_id,
        product_id: ext.id,
        amount: 0,
        status: "paid",
        payment_key: `subscription:${subscription.id}`,
        subscription_id: subscription.id,
      })
      .select()
      .single();

    if (!order) continue;

    const licenseKey = generateLicenseKey();
    await serviceSupabase.from("licenses").insert({
      order_id: order.id,
      user_id: subscription.user_id,
      product_id: ext.id,
      license_key: licenseKey,
      subscription_id: subscription.id,
    });

    results.push({ product_id: ext.id, license_key: licenseKey });
  }

  return NextResponse.json({
    status: "activated",
    created: results.length,
    total_extensions: extensions.length,
  });
}
