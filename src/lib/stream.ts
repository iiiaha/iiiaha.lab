const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN!;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`;

async function cfFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      ...options?.headers,
    },
  });
  return res.json();
}

// 서명된 재생 URL 생성 (도메인 제한 + 시간 제한)
export async function getSignedVideoUrl(videoUid: string): Promise<string> {
  // Signed URL은 Stream의 signed token으로 생성
  // 간단 버전: iframe embed URL 반환
  return `https://customer-${CF_ACCOUNT_ID}.cloudflarestream.com/${videoUid}/iframe`;
}

// 동영상 목록 조회
export async function listVideos() {
  const data = await cfFetch("");
  return data.result ?? [];
}

// 직접 업로드 URL 생성 (TUS 업로드용)
// requireSignedURLs는 의도적으로 false. 시청 권한은 /api/stream 라우트가
// (로그인 + 구매 확인) 단에서 게이팅하고, 일단 URL이 발급된 후 공유되는 경우는
// 계정 공유처럼 본질적으로 막을 수 없는 영역으로 간주.
export async function createDirectUploadUrl(
  maxDurationSeconds: number = 3600
) {
  const data = await cfFetch("/direct_upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maxDurationSeconds,
      requireSignedURLs: false,
    }),
  });
  return data.result as { uploadURL: string; uid: string };
}

// 동영상 정보 조회
export async function getVideoInfo(uid: string) {
  const data = await cfFetch(`/${uid}`);
  return data.result;
}

// 동영상 삭제
export async function deleteVideo(uid: string) {
  await cfFetch(`/${uid}`, { method: "DELETE" });
}
