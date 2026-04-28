import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { detectMimeByMagic, EXT_BY_MIME } from "@/lib/upload-utils";

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

  const form = await req.formData();
  const file = form.get("file");
  const slug = String(form.get("slug") ?? "").trim();
  const folder = String(form.get("folder") ?? "thumbnails").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file missing" }, { status: 400 });
  }
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (!/^[a-z0-9/_-]+$/i.test(folder)) {
    return NextResponse.json({ error: "invalid folder" }, { status: 400 });
  }

  // Magic byte 검증. 브라우저가 알려준 file.type / file.name은 신뢰하지 않음.
  const detectedMime = await detectMimeByMagic(file);
  if (!detectedMime) {
    return NextResponse.json(
      { error: "Unsupported file type (magic byte check failed)" },
      { status: 400 }
    );
  }

  // 확장자도 magic byte 결과 기준으로 결정 (사용자 파일명 신뢰 안 함).
  const ext = EXT_BY_MIME[detectedMime];
  const path = `${folder}/${slug}.${ext}`;

  const { error } = await serviceSupabase.storage
    .from("uploads")
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: detectedMime,
    });

  if (error) {
    console.error("[admin/upload] storage upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: { publicUrl } } = serviceSupabase.storage
    .from("uploads")
    .getPublicUrl(path);

  return NextResponse.json({ url: `${publicUrl}?v=${Date.now()}` });
}
