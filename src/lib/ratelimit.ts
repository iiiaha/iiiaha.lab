import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Vercel Marketplace Upstash 통합으로 자동 주입된 env vars 사용.
// 미설정 시 모든 limiter는 null이 되어 fail-open(통과)됨.
const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

type Window = `${number} ${"s" | "m" | "h"}`;

function makeLimiter(requests: number, window: Window): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
    prefix: "iiiahalab",
  });
}

// 라우트별 한도. 표적 공격 가능성과 정상 사용 빈도를 고려해 설정.
export const limiters = {
  licenseActivate: makeLimiter(10, "1 m"),
  licenseVerify: makeLimiter(60, "1 m"),
  licenseDeactivate: makeLimiter(10, "1 m"),
  paymentConfirm: makeLimiter(5, "1 m"),
  orderRefund: makeLimiter(3, "1 m"),
  coupon: makeLimiter(20, "1 m"),
  userEmail: makeLimiter(30, "1 m"),
  comments: makeLimiter(10, "1 m"),
  billingConfirm: makeLimiter(5, "1 m"),
  webhook: makeLimiter(100, "1 m"),
};

// 식별자: 인증된 사용자가 있으면 user.id, 없으면 IP.
export function getClientId(req: NextRequest, userId?: string): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `ip:${ip}`;
}

// 통과면 null, 차단이면 429 NextResponse 반환.
// Upstash 장애나 미설정 시 fail-open(정상 사용자 차단 방지).
export async function rateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) return null;

  try {
    const { success, limit, remaining, reset } = await limiter.limit(
      identifier
    );
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }
    return null;
  } catch (err) {
    console.error("[ratelimit] error", err);
    return null;
  }
}
