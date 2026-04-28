import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? user : null;
}

export async function POST(req: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { paths } = await req.json();
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "paths required" }, { status: 400 });
  }
  for (const p of paths) {
    if (typeof p !== "string" || p.includes("..") || p.startsWith("/") || p.length > 200) {
      return NextResponse.json({ error: `invalid path: ${p}` }, { status: 400 });
    }
  }

  const { error, data } = await serviceSupabase.storage.from("uploads").remove(paths);
  if (error) {
    console.error("[admin/delete-file] remove failed", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
  return NextResponse.json({ deleted: data?.map((d) => d.name) ?? [] });
}
