import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { generateLicenseKey } from "@/lib/license-utils";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdmin() {
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

// POST: 라이선스 수동 발급
export async function POST(req: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { product_id, user_email, memo } = await req.json();

  if (!product_id) {
    return NextResponse.json(
      { error: "product_id is required" },
      { status: 400 }
    );
  }

  // 상품 확인
  const { data: product } = await serviceSupabase
    .from("products")
    .select("id, name")
    .eq("id", product_id)
    .single();

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 유저 조회 (이메일이 있으면)
  let userId: string | null = null;
  if (user_email) {
    const {
      data: { users },
    } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 });
    const found = users.find(
      (u) => u.email?.toLowerCase() === user_email.toLowerCase()
    );
    userId = found?.id ?? null;
  }

  // 주문 생성 (금액 0, 관리자 수동 발급)
  const { data: order, error: orderError } = await serviceSupabase
    .from("orders")
    .insert({
      user_id: userId || admin.id,
      product_id,
      amount: 0,
      status: "paid",
      payment_key: memo ? `admin:${memo}` : "admin:manual",
    })
    .select()
    .single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  // 라이선스 키 생성
  const licenseKey = generateLicenseKey();
  const { error: licError } = await serviceSupabase.from("licenses").insert({
    order_id: order.id,
    user_id: userId || admin.id,
    product_id,
    license_key: licenseKey,
  });

  if (licError) {
    return NextResponse.json({ error: licError.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "created",
    license_key: licenseKey,
    product_name: product.name,
    order_id: order.id,
    assigned_to: user_email || "admin",
  });
}
