import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// 정식 배포 전까지 신규 가입을 차단한다.
// OAuth 콜백 시 방금 생성된 계정이면 즉시 삭제 + 로그아웃.
// 복구: SIGNUP_DISABLED 상수를 false로 바꾸면 된다.
const SIGNUP_DISABLED = true;
const NEW_USER_WINDOW_SECONDS = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (SIGNUP_DISABLED && data?.user) {
      const createdAt = new Date(data.user.created_at).getTime();
      const ageSeconds = (Date.now() - createdAt) / 1000;
      if (ageSeconds < NEW_USER_WINDOW_SECONDS) {
        // 방금 생성된 계정 → 즉시 삭제
        const serviceSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await serviceSupabase.auth.admin.deleteUser(data.user.id);
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=signup_disabled", req.url)
        );
      }
    }
  }

  const next = searchParams.get("next") || "/mypage";
  return NextResponse.redirect(new URL(next, req.url));
}
