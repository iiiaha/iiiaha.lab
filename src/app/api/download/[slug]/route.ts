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

  // 해당 제품 구매 확인 (paid 상태)
  const { data: order } = await serviceSupabase
    .from("orders")
    .select("id, products!inner(slug, display_name)")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .eq("products.slug", slug)
    .limit(1)
    .single();

  if (!order) {
    return NextResponse.json(
      { error: "Purchase not found" },
      { status: 403 }
    );
  }

  // Supabase Storage에서 rbz 파일 다운로드
  const filePath = `rbz/${slug}.rbz`;
  const { data, error } = await serviceSupabase.storage
    .from("uploads")
    .download(filePath);

  if (error || !data) {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 }
    );
  }

  const arrayBuffer = await data.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="iiiaha_${slug}.rbz"`,
    },
  });
}
