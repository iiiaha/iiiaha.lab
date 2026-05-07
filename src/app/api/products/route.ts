import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 공개 엔드포인트: iiiahalab downloader가 활성 익스텐션 목록 + 최신 버전을 일괄 조회.
// 인증 불필요. 60s CDN 캐시.
export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "slug, name, type, platform, version, file_key, thumbnail_url, sort_order, subtitle, description"
    )
    .eq("type", "extension")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
