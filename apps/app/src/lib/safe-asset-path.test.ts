import { describe, expect, test } from "bun:test";

import { toSafeImageAssetPath } from "./safe-asset-path";

describe("toSafeImageAssetPath", () => {
  test("returns the provided asset path when it is valid", () => {
    expect(toSafeImageAssetPath("/models/openai.svg")).toBe("/models/openai.svg");
  });

  test("returns an empty string when the value is empty or invalid", () => {
    expect(toSafeImageAssetPath("")).toBe("");
    expect(toSafeImageAssetPath("https://example.com/icon.svg")).toBe("");
    expect(toSafeImageAssetPath("javascript:alert(1)")).toBe("");
  });
});
