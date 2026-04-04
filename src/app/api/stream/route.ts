import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSignedVideoUrl } from "@/lib/stream";

export async function GET(req: NextRequest) {
  const episodeId = req.nextUrl.searchParams.get("episodeId");
  if (!episodeId) {
    return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });
  }

  // 유저 확인
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 에피소드 조회
  const { data: episode } = await supabase
    .from("course_episodes")
    .select("*, products(id)")
    .eq("id", episodeId)
    .single();

  if (!episode || !episode.video_uid) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  // 프리뷰 에피소드는 누구나 접근 가능
  if (!episode.is_preview) {
    // 구매 확인
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", episode.product_id)
      .eq("status", "paid")
      .single();

    if (!order) {
      return NextResponse.json(
        { error: "Purchase required" },
        { status: 403 }
      );
    }
  }

  const url = await getSignedVideoUrl(episode.video_uid);
  return NextResponse.json({ url });
}
