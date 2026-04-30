import { describe, expect, test } from "bun:test";

import {
  getInitialModelOverrideCron,
  getModelOverrideCron,
  normalizeEditorSchedule,
} from "./prompt-editor";

describe("getInitialModelOverrideCron", () => {
  test("starts a new model override with a cadence different from the global cadence", () => {
    expect(getInitialModelOverrideCron("0 */6 * * *")).toBe("0 9 * * *");
  });

  test("keeps a custom global cadence when every preset matches or is unavailable", () => {
    expect(getInitialModelOverrideCron("15 */3 * * *", [])).toBe("15 */3 * * *");
  });
});

describe("getModelOverrideCron", () => {
  test("replaces an existing override when it matches the global cadence", () => {
    expect(getModelOverrideCron("0 */6 * * *", "0 */6 * * *")).toBe("0 9 * * *");
  });

  test("keeps an existing override when it is already custom", () => {
    expect(getModelOverrideCron("0 */6 * * *", "0 9 * * *")).toBe("0 9 * * *");
  });
});

describe("normalizeEditorSchedule", () => {
  test("does not keep model overrides that are equal to the global cadence", () => {
    expect(
      normalizeEditorSchedule(
        {
          mode: "per_model",
          cron: "0 */6 * * *",
          timezone: "UTC",
          modelCrons: {
            "anthropic-claude-opus-4-6": "0 */6 * * *",
            "deepseek-deepseek-chat": "0 9 * * *",
          },
        },
        ["anthropic-claude-opus-4-6", "deepseek-deepseek-chat"],
      ).modelCrons,
    ).toEqual({
      "deepseek-deepseek-chat": "0 9 * * *",
    });
  });
});
