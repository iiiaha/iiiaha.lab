import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { generateLicenseKey } from "@/lib/license-utils";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, productId } = await req.json();

  // 1. 유저 확인
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 토스페이먼츠 결제 승인 (토스 승인 후 활성화)
  if (process.env.TOSS_SECRET_KEY) {
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
      const err = await tossRes.json();
      return NextResponse.json(
        { error: err.message || "Payment failed" },
        { status: 400 }
      );
    }
  }

  // 3. 상품 조회
  const { data: product } = await serviceSupabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 4. 주문 생성
  const { data: order, error: orderError } = await serviceSupabase
    .from("orders")
    .insert({
      user_id: user.id,
      product_id: productId,
      payment_key: paymentKey || null,
      amount,
      status: "paid",
    })
    .select()
    .single();

  if (orderError) {
    return NextResponse.json(
      { error: orderError.message },
      { status: 500 }
    );
  }

  // 5. 라이선스 키 생성
  const licenseKey = generateLicenseKey();
  const { error: licError } = await serviceSupabase.from("licenses").insert({
    order_id: order.id,
    user_id: user.id,
    product_id: productId,
    license_key: licenseKey,
  });

  if (licError) {
    return NextResponse.json(
      { error: licError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "success",
    license_key: licenseKey,
    order_id: order.id,
  });
}
