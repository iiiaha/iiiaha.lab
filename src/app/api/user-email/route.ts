import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("id");
  if (!userId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error } = await serviceSupabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    return NextResponse.json({ email: null });
  }

  // 이메일에서 아이디 추출 + 마스킹
  const email = data.user.email;
  const id = email.split("@")[0];
  let masked: string;
  if (id.length <= 2) {
    masked = id[0] + "*";
  } else if (id.length <= 4) {
    masked = id[0] + "*".repeat(id.length - 2) + id[id.length - 1];
  } else {
    masked = id.slice(0, 2) + "*".repeat(id.length - 4) + id.slice(-2);
  }

  return NextResponse.json({ name: masked });
}
