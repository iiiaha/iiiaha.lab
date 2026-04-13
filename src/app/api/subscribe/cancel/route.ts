import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription } = await serviceSupabase
    .from("subscriptions")
    .select("id, expires_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json(
      { error: "활성 구독이 없습니다" },
      { status: 404 }
    );
  }

  await serviceSupabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  return NextResponse.json({
    status: "cancel_scheduled",
    access_until: subscription.expires_at,
  });
}
