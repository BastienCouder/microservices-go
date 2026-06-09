import { describe, expect, test } from "bun:test";
import {
  createPromptRunProgressEntries,
  isMonitoringQueryForProject,
  isPromptRunProgressComplete,
  isPromptRunProgressExpired,
} from "./prompt-run-progress";

describe("prompt run progress", () => {
  test("marks a manual run complete when a new response arrives for each requested model", () => {
    const entries = createPromptRunProgressEntries(
      [
        {
          id: "row-1",
          sourcePromptId: "prompt-1",
          models: ["google-gemma-3-4b-free", "z-ai/glm-4.5-air"],
        },
      ],
      [
        {
          promptId: "prompt-1",
          modelId: "google-gemma-3-4b-free",
          createdAt: "2026-05-21T10:00:00Z",
        },
      ],
      new Date("2026-05-21T10:05:00Z"),
    );

    expect(entries).toHaveLength(1);
    expect(
      isPromptRunProgressComplete(entries[0]!, [
        {
          promptId: "prompt-1",
          modelId: "google-gemma-3-4b-free",
          createdAt: "2026-05-21T10:06:00Z",
        },
        {
          promptId: "prompt-1",
          modelProviderModelId: "z-ai/glm-4.5-air",
          createdAt: "2026-05-21T10:06:10Z",
        },
      ]),
    ).toBe(true);
  });

  test("keeps a manual run pending while one requested model still has no new response", () => {
    const entries = createPromptRunProgressEntries(
      [
        {
          id: "row-1",
          sourcePromptId: "prompt-1",
          models: ["google-gemma-3-4b-free", "z-ai/glm-4.5-air"],
        },
      ],
      [],
      new Date("2026-05-21T10:05:00Z"),
    );

    expect(
      isPromptRunProgressComplete(entries[0]!, [
        {
          promptId: "prompt-1",
          modelId: "google-gemma-3-4b-free",
          createdAt: "2026-05-21T10:06:00Z",
        },
      ]),
    ).toBe(false);
  });

  test("expires a stalled manual run after the timeout window", () => {
    const entry = createPromptRunProgressEntries(
      [{ id: "row-1", sourcePromptId: "prompt-1", models: ["google-gemma-3-4b-free"] }],
      [],
      new Date("2026-05-21T10:05:00Z"),
    )[0]!;

    expect(isPromptRunProgressExpired(entry, new Date("2026-05-21T10:06:00Z"))).toBe(false);
    expect(isPromptRunProgressExpired(entry, new Date("2026-05-21T10:07:01Z"))).toBe(true);
  });
});

describe("isMonitoringQueryForProject", () => {
  test("matches monitoring queries for the same project regardless of mode and history scope", () => {
    expect(
      isMonitoringQueryForProject(
        ["monitoring", "http://api", "project-1", "live", "include_historical_models"],
        "http://api",
        "project-1",
      ),
    ).toBe(true);
  });

  test("ignores queries from another project or another feature", () => {
    expect(
      isMonitoringQueryForProject(
        ["monitoring", "http://api", "project-2", "live", "active_only"],
        "http://api",
        "project-1",
      ),
    ).toBe(false);
    expect(
      isMonitoringQueryForProject(
        ["prompt-quota", "http://api", "org-1", "project-1"],
        "http://api",
        "project-1",
      ),
    ).toBe(false);
  });
});
