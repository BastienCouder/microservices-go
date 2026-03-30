import { describe, expect, test } from "bun:test";

import { MODELS, readAnalysisMode, signInternalJWT } from "./seed-nike-backend.ts";

function decodePayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("JWT payload is missing");
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

describe("seed-nike-backend", () => {
  test("readAnalysisMode supports synthetic and live", () => {
    expect(readAnalysisMode(undefined)).toBe("synthetic");
    expect(readAnalysisMode("synthetic")).toBe("synthetic");
    expect(readAnalysisMode("live")).toBe("live");
    expect(() => readAnalysisMode("nope")).toThrow("SEED_ANALYSIS_MODE invalide");
  });

  test("model catalog matches ia-service supported ids", () => {
    expect(MODELS.map((model) => model.id)).toEqual([
      "gpt-oss-20b-free",
      "gpt-oss-120b-free",
      "gemma-3-4b-free",
      "gemma-3-27b-free",
    ]);
  });

  test("signInternalJWT encodes issuer, audience and identities", () => {
    const token = signInternalJWT({
      secret: "test-secret",
      issuer: "api-gateway",
      audience: "analysis-service",
      subject: "seed-nike-backend",
      organizationId: 42,
      userId: 7,
      ttlSeconds: 300,
    });

    expect(token.split(".")).toHaveLength(3);

    const payload = decodePayload(token);
    expect(payload.iss).toBe("api-gateway");
    expect(payload.aud).toBe("analysis-service");
    expect(payload.sub).toBe("seed-nike-backend");
    expect(payload.organization_id).toBe(42);
    expect(payload.user_id).toBe(7);
  });
});
