import { describe, expect, test } from "bun:test";

import {
  MODELS,
  buildRuntimeSeedPlan,
  createIDAllocator,
  defaultMonthlyQuotaForPlan,
  defaultSeatsForPlan,
} from "./seed-nike-backend.ts";

const seedSource = await Bun.file(
  new URL("./seed-nike-backend.ts", import.meta.url),
).text();

function expectScopedUUID(value: string, prefix: string) {
  expect(value).toMatch(new RegExp(`^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, "i"));
}

describe("seed-nike-backend", () => {
  test("billing quotas match the public web pricing grid", () => {
    expect(defaultMonthlyQuotaForPlan("starter")).toBe(100);
    expect(defaultMonthlyQuotaForPlan("growth")).toBe(750);
    expect(defaultMonthlyQuotaForPlan("pro")).toBe(3_000);
    expect(defaultSeatsForPlan("starter")).toBe(1);
    expect(defaultSeatsForPlan("growth")).toBe(3);
    expect(defaultSeatsForPlan("pro")).toBe(5);
  });

  test("model catalog matches ia-service supported ids", () => {
    expect(MODELS.map((model) => model.id)).toEqual([
      "gpt-4o-mini",
      "claude-3-5-sonnet",
      "gemini-2.0-flash",
      "sonar",
      "mistral-large",
      "glm-4.5",
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
    expect(plan.runs.at(-1)?.promptRuns).toHaveLength(3);
    expect(plan.runs.at(-1)?.responses).toHaveLength(3 * MODELS.length);
    expect(plan.runs[0]?.responses).toHaveLength(6 * MODELS.length);
    expect(plan.alerts).toHaveLength(4);
    expectScopedUUID(plan.prompts[0]!.id, "prm");
    expectScopedUUID(plan.competitors[0]!.id, "cmp");
    expectScopedUUID(plan.runs[0]!.id, "run");
    expectScopedUUID(plan.runs[0]!.promptRuns[0]!.id, "prun");
    expectScopedUUID(plan.runs[0]!.responses[0]!.id, "resp");
    expectScopedUUID(plan.alerts[0]!.id, "alt");
  });

  test("disables monitoring prompts without charging seeded runs", () => {
    expect(seedSource.includes('isPerception ? "active" : "disabled"')).toBe(true);
    expect(seedSource.includes('isPerception ? "perception" : "monitoring"')).toBe(true);
    expect(seedSource.includes("${run.visibilityScore},\n      0,")).toBe(true);
    expect(seedSource.includes('runType: "perception"')).toBe(true);
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
});
