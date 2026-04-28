import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // 로그인 확인
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please log in first" }, { status: 401 });
  }

  const limited = await rateLimit(limiters.coupon, getClientId(req, user.id));
  if (limited) return limited;

  const { data: coupon } = await serviceSupabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .single();

  if (!coupon) {
    return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
  }

  if (!coupon.is_active) {
    return NextResponse.json({ error: "This coupon is no longer active" }, { status: 400 });
  }

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return NextResponse.json({ error: "This coupon is not yet available" }, { status: 400 });
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    return NextResponse.json({ error: "This coupon has expired" }, { status: 400 });
  }

  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ error: "This coupon has been fully redeemed" }, { status: 400 });
  }

  // 계정당 1회 사용 체크
  const { data: existing } = await serviceSupabase
    .from("coupon_uses")
    .select("id")
    .eq("coupon_id", coupon.id)
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You have already used this coupon" }, { status: 400 });
  }

  return NextResponse.json({
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    min_amount: coupon.min_amount,
  });
}
