import crypto from "crypto";

function getHmacSecret(): string {
  const secret = process.env.LICENSE_HMAC_SECRET;
  if (!secret) {
    throw new Error("LICENSE_HMAC_SECRET environment variable is required");
  }
  return secret;
}

export function generateLicenseKey(): string {
  // 128-bit 엔트로피. 32 hex chars, 4 그룹 (XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX).
  const hex = crypto.randomBytes(16).toString("hex").toUpperCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`;
}

export function signLicenseData(data: Record<string, unknown>): string {
  const payload = JSON.stringify(data);
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("hex");
}

export function verifySignature(
  data: Record<string, unknown>,
  signature: string
): boolean {
  const expected = signLicenseData(data);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}
