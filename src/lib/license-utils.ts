import crypto from "crypto";

function getHmacSecret(): string {
  const secret = process.env.LICENSE_HMAC_SECRET;
  if (!secret) {
    throw new Error("LICENSE_HMAC_SECRET environment variable is required");
  }
  return secret;
}

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
