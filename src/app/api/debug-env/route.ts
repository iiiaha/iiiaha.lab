import { NextResponse } from "next/server";

// 임시 진단 라우트. env 변수 주입 확인 후 삭제 예정.
export async function GET() {
  const check = (name: string) => {
    const v = process.env[name];
    return {
      defined: !!v,
      length: v?.length ?? 0,
      prefix: v?.slice(0, 8) ?? null,
    };
  };

  // 현재 코드에서 사용 중인 모든 env 변수를 한 번에 체크
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LICENSE_HMAC_SECRET",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_STREAM_TOKEN",
    "NEXT_PUBLIC_TOSS_CLIENT_KEY",
    "TOSS_SECRET_KEY",
    "TOSS_WEBHOOK_SECRET",
    "CRON_SECRET",
    "RESEND_API_KEY",
  ];

  const result: Record<string, ReturnType<typeof check>> = {};
  for (const v of vars) {
    result[v] = check(v);
  }

  // 프리픽스로 시작하는 모든 env 키 이름 나열 (값 노출 없이)
  const envKeys = Object.keys(process.env);
  const tossKeys = envKeys.filter((k) => k.includes("TOSS"));
  const nextPublicKeys = envKeys.filter((k) => k.startsWith("NEXT_PUBLIC_"));

  return NextResponse.json({
    vars: result,
    keys_containing_TOSS: tossKeys,
    keys_starting_NEXT_PUBLIC: nextPublicKeys,
    total_env_count: envKeys.length,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  });
}
