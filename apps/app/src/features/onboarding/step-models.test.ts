import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./step-models.tsx", import.meta.url)).text();

describe("step models", () => {
  test("shows the organization plan and enforces the plan model limit", () => {
    expect(source.includes("loadBillingEntitlements")).toBe(true);
    expect(source.includes("billingQuery")).toBe(true);
    expect(source.includes("modelsCurrentPlan")).toBe(true);
    expect(source.includes("disabledByPlan")).toBe(true);
    expect(source.includes("disabled={disabled}")).toBe(true);
    expect(source.includes("selectedCount >= selectionLimit")).toBe(true);
    expect(source.includes("modelsPlanLimitReached")).toBe(false);
  });
});
