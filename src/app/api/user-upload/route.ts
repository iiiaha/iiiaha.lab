import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { detectMimeByMagic, EXT_BY_MIME, IMAGE_MIMES } from "@/lib/upload-utils";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_FOLDERS = new Set(["openlab", "bug-reports", "systems"]);

// 인증 사용자가 자기 폴더에 이미지 업로드. magic byte 검증 + 폴더 화이트리스트 + 크기 제한.
// 클라이언트 직접 storage.upload 패턴을 대체한다.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file missing" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }
  if (!ALLOWED_FOLDERS.has(folder)) {
    return NextResponse.json({ error: "invalid folder" }, { status: 400 });
  }

  // Magic byte 검증. 이미지만 허용 — 사용자 업로드는 zip/rbz 불가.
  const detectedMime = await detectMimeByMagic(file);
  if (!detectedMime || !IMAGE_MIMES.includes(detectedMime)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  const ext = EXT_BY_MIME[detectedMime];
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${folder}/${user.id}/${filename}`;

  const { error } = await serviceSupabase.storage
    .from("uploads")
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: detectedMime,
    });

  if (error) {
    console.error("[user-upload] storage upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = serviceSupabase.storage.from("uploads").getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, path });
}
