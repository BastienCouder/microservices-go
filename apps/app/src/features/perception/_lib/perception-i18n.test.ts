import { describe, expect, test } from "bun:test";

import {
  resolvePerceptionGeneratedContent,
  resolvePerceptionLocalizedText,
} from "./perception-i18n";

describe("perception i18n resolvers", () => {
  test("resolves localized copy from a translation key when available", () => {
    expect(
      resolvePerceptionLocalizedText(
        "Raw fallback",
        "topErrorsGeneratedPositioningTitle",
        "en",
      ),
    ).toBe("Positioning is still not cited clearly enough");
  });

  test("falls back to raw copy when the translation key is missing", () => {
    expect(
      resolvePerceptionLocalizedText(
        "Raw fallback",
        "missing.translation.key",
        "fr",
      ),
    ).toBe("Raw fallback");
  });

  test("interpolates generated content translations with params", () => {
    expect(
      resolvePerceptionGeneratedContent(
        "Raw fallback",
        "crawlerImpactPage",
        "en",
        { resource: "https://example.com/pricing" },
      ),
    ).toBe("Issue detected on https://example.com/pricing.");
  });
});
