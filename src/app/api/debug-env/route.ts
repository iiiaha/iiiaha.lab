import { NextResponse } from "next/server";

// 임시 진단 라우트. env 변수 주입 확인 후 삭제 예정.
export async function GET() {
  const key = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  const secret = process.env.TOSS_SECRET_KEY;

  return NextResponse.json({
    // NEXT_PUBLIC_ — 서버 런타임에서도 보임
    NEXT_PUBLIC_TOSS_CLIENT_KEY: {
      defined: !!key,
      length: key?.length ?? 0,
      prefix: key?.slice(0, 12) ?? null,
      suffix: key?.slice(-4) ?? null,
    },
    // 서버 전용
    TOSS_SECRET_KEY: {
      defined: !!secret,
      length: secret?.length ?? 0,
      prefix: secret?.slice(0, 12) ?? null,
    },
    // 기타 체크
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  });
}
