import { describe, expect, test } from "bun:test";

import { deriveShortDescription } from "./brand-overview-helpers";

describe("deriveShortDescription", () => {
  test("prefers the explicit short description when available", () => {
    expect(
      deriveShortDescription({
        brandName: "Acme",
        shortDescription: "CRM IA pour PME.",
        category: "B2B CRM",
        positioning: "Description longue qui ne doit pas etre prioritaire.",
        audience: [],
        useCases: [],
        pricing: {
          amount: 0,
          currency: "",
          period: "",
        },
        features: [],
      }),
    ).toBe("CRM IA pour PME.");
  });

  test("falls back to the first sentence of the long description", () => {
    expect(
      deriveShortDescription({
        brandName: "Acme",
        shortDescription: "",
        category: "B2B CRM",
        positioning: "CRM IA pour PME. Deuxieme phrase plus detaillee.",
        audience: [],
        useCases: [],
        pricing: {
          amount: 0,
          currency: "",
          period: "",
        },
        features: [],
      }),
    ).toBe("CRM IA pour PME.");
  });
});
