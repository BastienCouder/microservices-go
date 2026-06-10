import { describe, expect, test } from "bun:test";

import {
  getBillingPlanLabel,
  getBillingPlanTranslationKey,
  isDeveloperBillingPlan,
  normalizeBillingPlan,
} from "./billing-plan";

describe("billing plans", () => {
  test("normalizes the developer plan and exposes its labels", () => {
    expect(normalizeBillingPlan("developer")).toBe("developer");
    expect(normalizeBillingPlan("dev")).toBe("developer");
    expect(getBillingPlanLabel("developer")).toBe("Developer");
    expect(getBillingPlanTranslationKey("developer")).toBe("planDeveloper");
    expect(isDeveloperBillingPlan("developer")).toBe(true);
    expect(isDeveloperBillingPlan("growth")).toBe(false);
    expect(isDeveloperBillingPlan(null)).toBe(false);
  });

});
