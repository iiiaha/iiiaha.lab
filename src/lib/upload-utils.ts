// 파일 업로드 시 magic byte 검증 유틸. admin/upload, api/user-upload 양쪽에서 공유.
// 브라우저가 알려주는 file.type / file.name은 신뢰하지 않고 첫 16바이트로 직접 판정.

export type DetectedMime =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "application/zip";

export async function detectMimeByMagic(
  file: File
): Promise<DetectedMime | null> {
  const buf = Buffer.from(await file.slice(0, 16).arrayBuffer());

  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif";
  }
  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  // ZIP: PK\x03\x04 또는 PK\x05\x06
  if (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05) &&
    (buf[3] === 0x04 || buf[3] === 0x06)
  ) {
    return "application/zip";
  }

  return null;
}

export const EXT_BY_MIME: Record<DetectedMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/zip": "rbz",
};

export const IMAGE_MIMES: DetectedMime[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];
