import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signLicenseData } from "@/lib/license-utils";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const limited = await rateLimit(limiters.licenseActivate, getClientId(req));
  if (limited) return limited;

  const { license_key, product_slug, hwid } = await req.json();

  if (!license_key || !product_slug || !hwid) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // 라이선스 조회
  const { data: license, error } = await supabase
    .from("licenses")
    .select("*, products(slug)")
    .eq("license_key", license_key)
    .single();

  if (error || !license) {
    return NextResponse.json(
      { error: "Invalid license key" },
      { status: 404 }
    );
  }

  // 상품 일치 확인
  if (license.products?.slug !== product_slug) {
    return NextResponse.json(
      { error: "License does not match this product" },
      { status: 403 }
    );
  }

  // 이미 해제된 라이선스
  if (license.status === "revoked") {
    return NextResponse.json(
      { error: "License has been revoked" },
      { status: 403 }
    );
  }

  // 구독 라이선스인 경우 구독 상태 확인
  if (license.subscription_id) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, expires_at")
      .eq("id", license.subscription_id)
      .single();

    if (!subscription || subscription.status === "expired") {
      await supabase
        .from("licenses")
        .update({ status: "revoked" })
        .eq("id", license.id);

      return NextResponse.json(
        { error: "License has been revoked" },
        { status: 403 }
      );
    }

    if (
      subscription.status === "past_due" &&
      new Date(subscription.expires_at) < new Date()
    ) {
      await supabase
        .from("licenses")
        .update({ status: "revoked" })
        .eq("id", license.id);

      return NextResponse.json(
        { error: "License has been revoked" },
        { status: 403 }
      );
    }
  }

  // 아직 활성화 안 됨 → 바인딩
  if (!license.hwid) {
    await supabase
      .from("licenses")
      .update({ hwid, activated_at: new Date().toISOString() })
      .eq("id", license.id);

    const tokenData = {
      license_key,
      product_slug,
      hwid,
      activated_at: new Date().toISOString(),
      expires_check: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    return NextResponse.json({
      status: "activated",
      token: tokenData,
      signature: signLicenseData(tokenData),
    });
  }

  // 같은 기기
  if (license.hwid === hwid) {
    const tokenData = {
      license_key,
      product_slug,
      hwid,
      activated_at: license.activated_at,
      expires_check: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    return NextResponse.json({
      status: "already_active",
      token: tokenData,
      signature: signLicenseData(tokenData),
    });
  }

  // 다른 기기
  return NextResponse.json(
    { error: "License is already activated on another device" },
    { status: 403 }
  );
}
