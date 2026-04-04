import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signLicenseData } from "@/lib/license-utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { license_key, product_slug, hwid } = await req.json();

  if (!license_key || !product_slug || !hwid) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const { data: license } = await supabase
    .from("licenses")
    .select("*, products(slug)")
    .eq("license_key", license_key)
    .single();

  if (!license) {
    return NextResponse.json(
      { error: "Invalid license key" },
      { status: 404 }
    );
  }

  if (license.status === "revoked") {
    return NextResponse.json(
      { error: "License has been revoked" },
      { status: 403 }
    );
  }

  if (license.products?.slug !== product_slug) {
    return NextResponse.json(
      { error: "License does not match this product" },
      { status: 403 }
    );
  }

  if (license.hwid !== hwid) {
    return NextResponse.json(
      { error: "License is activated on another device" },
      { status: 403 }
    );
  }

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
    status: "valid",
    token: tokenData,
    signature: signLicenseData(tokenData),
  });
}
