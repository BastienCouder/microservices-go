import { describe, expect, test } from "bun:test";

import {
  MODELS,
  buildRuntimeSeedPlan,
  createIDAllocator,
  defaultMonthlyQuotaForPlan,
  readAnalysisMode,
  signInternalJWT,
} from "./seed-nike-backend.ts";

function expectScopedUUID(value: string, prefix: string) {
  expect(value).toMatch(new RegExp(`^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, "i"));
}

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
  test("billing quotas match the public web pricing grid", () => {
    expect(defaultMonthlyQuotaForPlan("starter")).toBe(100);
    expect(defaultMonthlyQuotaForPlan("growth")).toBe(750);
    expect(defaultMonthlyQuotaForPlan("pro")).toBe(3_000);
  });

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

  test("id allocator increments shared sequences with service prefixes", () => {
    const allocator = createIDAllocator(357);
    expectScopedUUID(allocator.next("prj"), "prj");
    expectScopedUUID(allocator.next("prm"), "prm");
    expectScopedUUID(allocator.next("cmp"), "cmp");
    expect(allocator.current()).toBe(360);
  });

  test("runtime seed plan auto-generates coherent ids", () => {
    const plan = buildRuntimeSeedPlan({
      projectSeqStart: 357,
      analysisSeqStart: 158,
      cleanupProjectIDs: ["nike"],
    });

    expectScopedUUID(plan.projectId, "prj");
    expect(plan.cleanupProjectIDs).toEqual(["nike", plan.projectId]);
    expect(plan.prompts).toHaveLength(6);
    expect(plan.competitors).toHaveLength(6);
    expect(plan.perceptionPrompts).toHaveLength(3);
    expect(plan.runs).toHaveLength(10);
    expect(plan.runs.at(-1)?.runType).toBe("perception");
    expect(plan.runs.at(-1)?.promptKind).toBe("perception");
    expect(plan.alerts).toHaveLength(4);
    expectScopedUUID(plan.prompts[0]!.id, "prm");
    expectScopedUUID(plan.competitors[0]!.id, "cmp");
    expectScopedUUID(plan.runs[0]!.id, "run");
    expectScopedUUID(plan.runs[0]!.promptRuns[0]!.id, "prun");
    expectScopedUUID(plan.runs[0]!.responses[0]!.id, "resp");
    expectScopedUUID(plan.alerts[0]!.id, "alt");
    expect(plan.liveRequestId).toBe(`${plan.projectId}-live-seed`);
  });

  test("runtime seed plan reuses generated project ids", () => {
    const reusableProjectID = "prj_11111111-2222-4333-8444-555555555555";
    const plan = buildRuntimeSeedPlan({
      projectSeqStart: 357,
      analysisSeqStart: 158,
      reusableProjectID,
      cleanupProjectIDs: ["nike", reusableProjectID],
    });

    expect(plan.projectId).toBe(reusableProjectID);
    expect(plan.cleanupProjectIDs).toEqual(["nike", reusableProjectID]);
    expectScopedUUID(plan.prompts[0]!.id, "prm");
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
