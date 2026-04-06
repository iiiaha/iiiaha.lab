import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .single();

  if (!coupon) {
    return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
  }

  // 활성화 체크
  if (!coupon.is_active) {
    return NextResponse.json({ error: "This coupon is no longer active" }, { status: 400 });
  }

  // 기간 체크
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return NextResponse.json({ error: "This coupon is not yet available" }, { status: 400 });
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    return NextResponse.json({ error: "This coupon has expired" }, { status: 400 });
  }

  // 사용 횟수 체크
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ error: "This coupon has been fully redeemed" }, { status: 400 });
  }

  return NextResponse.json({
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    min_amount: coupon.min_amount,
  });
}
