import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // 로그인 확인
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 제품 조회 (file_key, version 포함)
  const { data: product } = await serviceSupabase
    .from("products")
    .select("id, file_key, platform, version")
    .eq("slug", slug)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 해당 제품 구매 확인 (paid 상태)
  const { data: order } = await serviceSupabase
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", product.id)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 403 });
  }

  // 다운로드 성공 전 라이선스의 last_downloaded_version 을 현재 제품 버전으로 기록.
  // 스트리밍 실패 시에도 이미 기록이 앞서 들어가지만, 유저가 실제 바이너리를 받지 못한 경우만
  // 다음 업데이트 프롬프트가 1회 누락되는 정도의 영향이라 허용.
  if (product.version) {
    await serviceSupabase
      .from("licenses")
      .update({ last_downloaded_version: product.version })
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .eq("status", "active");
  }

  // Storage 경로 결정: file_key 우선, 없으면 sketchup 관례(rbz/{slug}.rbz)로 fallback
  const filePath = product.file_key || `rbz/${slug}.rbz`;
  const ext = (filePath.split(".").pop() || "bin").toLowerCase();

  const { data, error } = await serviceSupabase.storage
    .from("uploads")
    .download(filePath);

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const arrayBuffer = await data.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="iiiaha_${slug}.${ext}"`,
    },
  });
}
