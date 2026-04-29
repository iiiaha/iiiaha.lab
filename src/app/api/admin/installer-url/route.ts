import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

// 큰 RBZ가 Vercel Lambda 4.5MB 한도에 막히는 문제 회피용.
// admin 인증 후 Supabase에 signed upload URL 발급 → 클라이언트가 직접 PUT.

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

const ALLOWED_EXT_BY_PLATFORM: Record<string, string[]> = {
  sketchup: ["rbz"],
  autocad: ["exe", "msi", "zip"],
};

export async function POST(req: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug, platform, ext } = await req.json();

  if (typeof slug !== "string" || !/^[a-z0-9-]+$/i.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  const allowed = ALLOWED_EXT_BY_PLATFORM[platform];
  if (!allowed) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  if (typeof ext !== "string" || !allowed.includes(ext.toLowerCase())) {
    return NextResponse.json({ error: "invalid ext" }, { status: 400 });
  }

  const folder = platform === "sketchup" ? "rbz" : "installers";
  const path = `${folder}/${slug}.${ext.toLowerCase()}`;

  const { data, error } = await serviceSupabase.storage
    .from("uploads")
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    console.error("[admin/installer-url] createSignedUploadUrl failed", error);
    return NextResponse.json({ error: "Failed to issue upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}
