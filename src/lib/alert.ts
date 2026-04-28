import { Resend } from "resend";

// Critical 에러 발생 시 운영자에게 즉시 이메일 발송.
// 5분 dedup 캐시로 같은 종류 에러 반복 시 스팸 방지.

const resend = new Resend(process.env.RESEND_API_KEY);

const ALERT_FROM = "iiiaha.lab alerts <noreply@iiiahalab.com>";
const ALERT_TO = "iiiaha@naver.com";

// 5분 dedup. 같은 key는 5분 내에 1번만 발송.
const recent = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 운영자에게 critical 알림 메일 발송.
 * @param key 중복 그룹핑 키 (예: "payment-confirm-fail"). 5분 내 같은 키는 한 번만 발송.
 * @param subject 메일 제목 (자동으로 🚨 prefix 붙음)
 * @param body 메일 본문 (HTML escape 자동 적용, monospace로 렌더링)
 */
export async function sendAlert(
  key: string,
  subject: string,
  body: string
): Promise<void> {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) {
    return;
  }
  recent.set(key, now);

  // 캐시가 너무 커지면 오래된 항목 정리
  if (recent.size > 50) {
    const sorted = Array.from(recent.entries()).sort((a, b) => a[1] - b[1]);
    for (const [k] of sorted.slice(0, 25)) recent.delete(k);
  }

  try {
    await resend.emails.send({
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: `🚨 ${subject}`,
      html: `<pre style="font-family: monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${escapeHtml(
        body
      )}</pre>`,
    });
  } catch (e) {
    // 알림 발송 자체 실패는 console에만 (재귀 방지)
    console.error("[alert] failed to send", e);
  }
}

/**
 * Error 객체나 일반 에러 object(예: Supabase PostgrestError)에서 메시지 추출.
 */
export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}\n${err.stack ?? ""}`;
  }
  if (err && typeof err === "object") {
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
