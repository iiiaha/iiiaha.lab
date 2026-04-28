import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { limiters, getClientId, rateLimit } from "@/lib/ratelimit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const limited = await rateLimit(limiters.licenseDeactivate, getClientId(req));
  if (limited) return limited;

  const { license_key, hwid } = await req.json();

  if (!license_key || !hwid) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("license_key", license_key)
    .single();

  if (!license) {
    return NextResponse.json(
      { error: "Invalid license key" },
      { status: 404 }
    );
  }

  if (license.hwid !== hwid) {
    return NextResponse.json(
      { error: "Device mismatch" },
      { status: 403 }
    );
  }

  await supabase
    .from("licenses")
    .update({ hwid: null, activated_at: null })
    .eq("id", license.id);

  return NextResponse.json({ status: "deactivated" });
}
