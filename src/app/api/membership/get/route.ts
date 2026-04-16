import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { generateLicenseKey } from "@/lib/license-utils";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // 1. 인증
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { product_slug } = await req.json();
  if (!product_slug) {
    return NextResponse.json(
      { error: "product_slug is required" },
      { status: 400 }
    );
  }

  // 2. 활성 멤버십 확인
  const { data: subscription } = await serviceSupabase
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json(
      { error: "Active membership required" },
      { status: 403 }
    );
  }

  // 3. 상품 확인 (스케치업 익스텐션만)
  const { data: product } = await serviceSupabase
    .from("products")
    .select("id, type, is_active")
    .eq("slug", product_slug)
    .single();

  if (!product) {
    return NextResponse.json(
      { error: "Product not found" },
      { status: 404 }
    );
  }

  if (product.type !== "extension" || !product.is_active) {
    return NextResponse.json(
      { error: "This product is not available for membership" },
      { status: 403 }
    );
  }

  // 4. 이미 보유 중인지 확인 (영구구매 또는 멤버십 get)
  const { data: existing } = await serviceSupabase
    .from("licenses")
    .select("id, status, subscription_id")
    .eq("user_id", user.id)
    .eq("product_id", product.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // 영구구매 라이선스 (subscription_id가 null)
    if (!existing.subscription_id) {
      return NextResponse.json(
        { error: "Already owned (permanent)" },
        { status: 400 }
      );
    }

    // 이미 활성 멤버십 라이선스
    if (existing.status === "active") {
      return NextResponse.json(
        { error: "Already added to your membership" },
        { status: 400 }
      );
    }

    // revoked 멤버십 라이선스 → 복구
    if (existing.status === "revoked") {
      await serviceSupabase
        .from("licenses")
        .update({
          status: "active",
          subscription_id: subscription.id,
        })
        .eq("id", existing.id);

      return NextResponse.json({
        status: "revived",
        product_slug,
      });
    }
  }

  // 5. 주문 생성 + 라이선스 발급
  const { data: order, error: orderErr } = await serviceSupabase
    .from("orders")
    .insert({
      user_id: user.id,
      product_id: product.id,
      amount: 0,
      status: "paid",
      payment_key: `membership:${subscription.id}`,
      subscription_id: subscription.id,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }

  const { error: insertErr } = await serviceSupabase
    .from("licenses")
    .insert({
      order_id: order.id,
      user_id: user.id,
      product_id: product.id,
      license_key: generateLicenseKey(),
      subscription_id: subscription.id,
    });

  if (insertErr) {
    return NextResponse.json(
      { error: "Failed to issue license" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "granted",
    product_slug,
  });
}
