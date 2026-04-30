import { describe, expect, test } from "bun:test";

import { normalizeBillingEntitlements } from "./billing";

describe("billing entitlements", () => {
  test("normalizes subscription status and paid flag", () => {
    expect(
      normalizeBillingEntitlements({
        organization_id: 7,
        plan: "growth",
        subscription_status: "active",
        is_paid: true,
        monthly_quota: 200,
        seats: 3,
        model_selection_limit: 6,
      }),
    ).toEqual({
      organizationId: "7",
      plan: "growth",
      subscriptionStatus: "active",
      isPaid: true,
      monthlyQuota: 200,
      seats: 3,
      modelSelectionLimit: 6,
    });
  });

  test("defaults missing paid data to unpaid", () => {
    expect(
      normalizeBillingEntitlements({
        organization_id: 7,
        plan: "starter",
      }).isPaid,
    ).toBe(false);
  });
});
