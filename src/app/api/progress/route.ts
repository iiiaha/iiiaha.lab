import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

// GET: 특정 강의의 전체 진도 조회
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 해당 강의의 모든 에피소드 ID 조회
  const { data: episodes } = await supabase
    .from("course_episodes")
    .select("id, duration")
    .eq("product_id", productId);

  if (!episodes || episodes.length === 0) {
    return NextResponse.json({ progress: [], summary: { total: 0, completed: 0 } });
  }

  const episodeIds = episodes.map((e) => e.id);

  // 유저의 진도 조회
  const { data: progress } = await supabase
    .from("course_progress")
    .select("episode_id, watched_seconds, completed, updated_at")
    .eq("user_id", user.id)
    .in("episode_id", episodeIds);

  // 에피소드별 진도 맵
  const progressMap: Record<
    string,
    { watched_seconds: number; completed: boolean; percent: number }
  > = {};

  for (const ep of episodes) {
    const p = progress?.find((pr) => pr.episode_id === ep.id);
    const duration = ep.duration || 1;
    const watched = p?.watched_seconds || 0;
    progressMap[ep.id] = {
      watched_seconds: watched,
      completed: p?.completed || false,
      percent: Math.min(Math.round((watched / duration) * 100), 100),
    };
  }

  const completedCount = Object.values(progressMap).filter(
    (p) => p.completed
  ).length;

  return NextResponse.json({
    progress: progressMap,
    summary: {
      total: episodes.length,
      completed: completedCount,
    },
  });
}

// POST: 시청 시간 저장 (upsert)
export async function POST(req: NextRequest) {
  const { episodeId, watchedSeconds, duration } = await req.json();

  if (!episodeId || watchedSeconds === undefined) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 90% 이상 시청 시 완료 처리
  const completed =
    duration && duration > 0 ? watchedSeconds / duration >= 0.9 : false;

  // 기존 기록 확인
  const { data: existing } = await supabase
    .from("course_progress")
    .select("id, watched_seconds, completed")
    .eq("user_id", user.id)
    .eq("episode_id", episodeId)
    .single();

  if (existing) {
    // 이미 완료된 에피소드는 completed를 되돌리지 않음
    // 시청 시간은 더 큰 값으로만 업데이트 (되감기로 인한 감소 방지)
    const newWatched = Math.max(existing.watched_seconds, watchedSeconds);
    const newCompleted = existing.completed || completed;

    const { error } = await supabase
      .from("course_progress")
      .update({
        watched_seconds: newWatched,
        completed: newCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error("[progress] update failed", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  } else {
    // 새 기록
    const { error } = await supabase.from("course_progress").insert({
      user_id: user.id,
      episode_id: episodeId,
      watched_seconds: watchedSeconds,
      completed,
    });

    if (error) {
      console.error("[progress] insert failed", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  return NextResponse.json({ status: "ok", completed });
}
