import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin() {
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

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { subscription_id } = await req.json();
  if (!subscription_id) {
    return NextResponse.json(
      { error: "subscription_id is required" },
      { status: 400 }
    );
  }

  const { data: subscription } = await serviceSupabase
    .from("subscriptions")
    .select("id, user_id, status")
    .eq("id", subscription_id)
    .single();

  if (!subscription) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();

  // 1. 구독 즉시 만료 처리 (사용자 셀프 해지와 달리 기간 끝까지 유지하지 않음)
  await serviceSupabase
    .from("subscriptions")
    .update({
      status: "expired",
      cancel_at_period_end: true,
      canceled_at: now,
      expires_at: now,
    })
    .eq("id", subscription.id);

  // 2. 이 구독으로 발급된 모든 라이선스 즉시 revoke
  const { data: revokedLicenses } = await serviceSupabase
    .from("licenses")
    .update({ status: "revoked" })
    .eq("subscription_id", subscription.id)
    .select("id");

  return NextResponse.json({
    status: "canceled",
    subscription_id: subscription.id,
    revoked_licenses: revokedLicenses?.length ?? 0,
  });
}
