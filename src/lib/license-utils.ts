import crypto from "crypto";

const HMAC_SECRET = process.env.LICENSE_HMAC_SECRET || "iiiaha-license-secret-change-me";

export function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(
      crypto.randomBytes(2).toString("hex").toUpperCase()
    );
  }
  return segments.join("-");
}

export function signLicenseData(data: Record<string, unknown>): string {
  const payload = JSON.stringify(data);
  return crypto
    .createHmac("sha256", HMAC_SECRET)
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
