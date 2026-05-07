import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 공개 엔드포인트: iiiahalab downloader가 .rbz를 익명으로 다운로드.
// 인증/구매 확인 없음. 익스텐션 본체의 license.rbe가 런타임에 라이선스를 검증한다.
// 사이트 마이페이지용 /api/download/[slug]는 그대로 인증/구매 확인을 유지.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: product } = await serviceSupabase
    .from("products")
    .select("file_key, version, type, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (!product || product.type !== "extension" || !product.is_active) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = product.file_key || `rbz/${slug}.rbz`;
  const ext = (filePath.split(".").pop() || "bin").toLowerCase();

  const { data, error } = await serviceSupabase.storage
    .from("uploads")
    .download(filePath);

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const arrayBuffer = await data.arrayBuffer();

  const versionToken = product.version
    ? "_v" + product.version.replace(/^v/i, "").replace(/[^a-zA-Z0-9.\-]/g, "")
    : "";
  const downloadName = `iiiaha_${slug}${versionToken}.${ext}`;

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
