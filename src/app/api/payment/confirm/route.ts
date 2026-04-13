import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { generateLicenseKey } from "@/lib/license-utils";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ConfirmBody {
  paymentKey: string;
  orderId: string;
  amount: number;
  items: { productId: string }[];
  couponCode?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ConfirmBody;
  const { paymentKey, orderId, amount, items, couponCode } = body;

  if (!paymentKey || !orderId || typeof amount !== "number" || !items?.length) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // 1. 인증
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 동일 paymentKey로 이미 처리된 주문이 있으면 그대로 반환 (idempotent)
  const { data: existingOrders } = await serviceSupabase
    .from("orders")
    .select("id, product_id, licenses(license_key)")
    .eq("payment_key", paymentKey);

  if (existingOrders && existingOrders.length > 0) {
    return NextResponse.json({
      status: "success",
      already_processed: true,
      licenses: existingOrders.flatMap((o) =>
        (o.licenses as { license_key: string }[] | null)?.map((l) => ({
          product_id: o.product_id,
          license_key: l.license_key,
        })) ?? []
      ),
    });
  }

  // 3. 상품 조회 및 중복 제거
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { data: products } = await serviceSupabase
    .from("products")
    .select("id, price, name, is_active")
    .in("id", productIds);

  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }
  if (products.some((p) => !p.is_active)) {
    return NextResponse.json({ error: "Item is not available" }, { status: 400 });
  }

  // 4. 이미 같은 유저가 구매한 상품이 있는지 확인 (중복 구매 방지)
  const { data: alreadyOwned } = await serviceSupabase
    .from("orders")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .in("product_id", productIds);

  if (alreadyOwned && alreadyOwned.length > 0) {
    return NextResponse.json(
      { error: "You already own one or more of these items" },
      { status: 400 }
    );
  }

  // 5. 서버 측에서 금액 재계산
  const subtotal = products.reduce((s, p) => s + p.price, 0);

  let discount = 0;
  let couponRow: { id: string } | null = null;

  if (couponCode) {
    const normalized = couponCode.toUpperCase().trim();
    const { data: coupon } = await serviceSupabase
      .from("coupons")
      .select("*")
      .eq("code", normalized)
      .single();

    if (!coupon || !coupon.is_active) {
      return NextResponse.json({ error: "Invalid coupon" }, { status: 400 });
    }
    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return NextResponse.json({ error: "Coupon not yet available" }, { status: 400 });
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return NextResponse.json({ error: "Coupon expired" }, { status: 400 });
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ error: "Coupon fully redeemed" }, { status: 400 });
    }
    if (coupon.min_amount && subtotal < coupon.min_amount) {
      return NextResponse.json({ error: "Below minimum order amount" }, { status: 400 });
    }

    // 계정당 1회
    const { data: existingUse } = await serviceSupabase
      .from("coupon_uses")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (existingUse) {
      return NextResponse.json({ error: "Coupon already used" }, { status: 400 });
    }

    discount =
      coupon.discount_type === "percent"
        ? Math.round(subtotal * (coupon.discount_value / 100))
        : coupon.discount_value;

    couponRow = { id: coupon.id };
  }

  const computedAmount = Math.max(0, subtotal - discount);

  if (computedAmount !== amount) {
    return NextResponse.json(
      { error: "Amount mismatch", expected: computedAmount },
      { status: 400 }
    );
  }

  // 6. 토스페이먼츠 결제 승인
  if (!process.env.TOSS_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 }
    );
  }

  const tossRes = await fetch(
    "https://api.tosspayments.com/v1/payments/confirm",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    }
  );

  if (!tossRes.ok) {
    const err = await tossRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.message || "Payment confirmation failed" },
      { status: 400 }
    );
  }

  // 7. 할인 비례 분배 (각 order.amount의 합이 computedAmount와 일치하도록)
  const orderAmounts: number[] = [];
  if (subtotal === 0) {
    products.forEach(() => orderAmounts.push(0));
  } else {
    let remaining = computedAmount;
    products.forEach((p, idx) => {
      if (idx === products.length - 1) {
        orderAmounts.push(remaining);
      } else {
        const share = Math.round((p.price / subtotal) * computedAmount);
        orderAmounts.push(share);
        remaining -= share;
      }
    });
  }

  // 8. 주문 + 라이선스 생성
  const results: { product_id: string; license_key: string }[] = [];
  let firstOrderId: string | null = null;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const { data: order, error: orderErr } = await serviceSupabase
      .from("orders")
      .insert({
        user_id: user.id,
        product_id: p.id,
        payment_key: paymentKey,
        amount: orderAmounts[i],
        status: "paid",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: "Failed to create order", detail: orderErr?.message },
        { status: 500 }
      );
    }

    if (!firstOrderId) firstOrderId = order.id;

    const licenseKey = generateLicenseKey();
    const { error: licErr } = await serviceSupabase.from("licenses").insert({
      order_id: order.id,
      user_id: user.id,
      product_id: p.id,
      license_key: licenseKey,
    });

    if (licErr) {
      return NextResponse.json(
        { error: "Failed to create license", detail: licErr.message },
        { status: 500 }
      );
    }

    results.push({ product_id: p.id, license_key: licenseKey });
  }

  // 9. 쿠폰 사용 기록
  if (couponRow && firstOrderId) {
    await serviceSupabase.from("coupon_uses").insert({
      coupon_id: couponRow.id,
      user_id: user.id,
      order_id: firstOrderId,
    });
    await serviceSupabase.rpc("increment_coupon_used", {
      coupon_id: couponRow.id,
    });
  }

  return NextResponse.json({
    status: "success",
    licenses: results,
    total: computedAmount,
  });
}
