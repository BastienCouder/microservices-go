import { describe, expect, test } from "bun:test";

import {
  getGA4PropertyDisplayLabel,
  getGA4PropertySummary,
} from "./ga4-property-labels";

describe("GA4 property labels", () => {
  test("keeps the property name and id visible together", () => {
    expect(
      getGA4PropertyDisplayLabel({
        propertyId: "528546502",
        displayName: "Nike France",
        accountName: "Nike",
      }),
    ).toBe("Nike France - ID 528546502 - Nike");
  });

  test("summarizes the selected property with its permanent name when loaded", () => {
    expect(
      getGA4PropertySummary("528546502", [
        {
          propertyId: "528546502",
          displayName: "Nike France",
          accountName: "Nike",
        },
      ]),
    ).toBe("Nike France - ID 528546502 - Nike");
  });

  test("falls back to the id while properties are still loading", () => {
    expect(getGA4PropertySummary("528546502", [])).toBe("ID 528546502");
  });
});
