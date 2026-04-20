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

  // 제품 조회 (file_key 포함)
  const { data: product } = await serviceSupabase
    .from("products")
    .select("id, file_key, platform")
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
