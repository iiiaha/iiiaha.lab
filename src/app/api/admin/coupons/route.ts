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
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { code, discount_type, discount_value, min_amount, max_uses, expires_at } = body;

  if (!code || !discount_type || !discount_value) {
    return NextResponse.json({ error: "code, discount_type, discount_value 필수" }, { status: 400 });
  }
  if (discount_type !== "percent" && discount_type !== "fixed") {
    return NextResponse.json({ error: "discount_type은 percent 또는 fixed" }, { status: 400 });
  }

  const { error } = await serviceSupabase.from("coupons").insert({
    code: String(code).toUpperCase().trim(),
    discount_type,
    discount_value: Number(discount_value),
    min_amount: min_amount ? Number(min_amount) : null,
    max_uses: max_uses ? Number(max_uses) : null,
    expires_at: expires_at || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ status: "created" });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, is_active } = await req.json();
  if (!id || typeof is_active !== "boolean") {
    return NextResponse.json({ error: "id, is_active 필수" }, { status: 400 });
  }

  const { error } = await serviceSupabase
    .from("coupons")
    .update({ is_active })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ status: "updated" });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const { error } = await serviceSupabase.from("coupons").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ status: "deleted" });
}
