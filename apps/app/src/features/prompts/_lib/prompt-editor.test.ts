import { describe, expect, test } from "bun:test";

import {
  cadenceBuilderToCron,
  cronToCadenceBuilder,
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

describe("cronToCadenceBuilder", () => {
  test("parses a multi-day cron into builder fields", () => {
    expect(cronToCadenceBuilder("0 9 * * 1,4")).toEqual({
      kind: "selected_days",
      time: "09:00",
      selectedDays: ["1", "4"],
      customCron: "0 9 * * 1,4",
    });
  });

  test("falls back to custom for unsupported cron expressions", () => {
    expect(cronToCadenceBuilder("15 */3 * * *")).toEqual({
      kind: "custom",
      time: "09:00",
      selectedDays: ["1", "4"],
      customCron: "15 */3 * * *",
    });
  });
});

describe("cadenceBuilderToCron", () => {
  test("builds a selected-days cron from builder fields", () => {
    expect(
      cadenceBuilderToCron({
        kind: "selected_days",
        time: "14:30",
        selectedDays: ["4", "1"],
        customCron: "",
      }),
    ).toBe("30 14 * * 1,4");
  });
});
