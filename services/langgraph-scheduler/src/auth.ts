import { createHmac } from "node:crypto";

interface SignInternalJWTInput {
  secret: string;
  issuer: string;
  audience: string;
  subject: string;
  organizationId?: number;
  userId?: number;
  ttlSeconds?: number;
}

function base64url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function signInternalJWT({
  secret,
  issuer,
  audience,
  subject,
  organizationId = 0,
  userId = 0,
  ttlSeconds = 300,
}: SignInternalJWTInput): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const payload: Record<string, number | string> = {
    iss: issuer,
    sub: subject,
    aud: audience,
    iat: now,
    exp: now + ttlSeconds,
  };

  if (organizationId > 0) {
    payload.organization_id = organizationId;
  }
  if (userId > 0) {
    payload.user_id = userId;
  }

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(unsignedToken).digest("base64url");

  return `${unsignedToken}.${signature}`;
}
