import { afterEach, describe, expect, test } from "bun:test";

import {
  buildStartPromptAnalysisPayload,
  startPromptAnalysis,
  startPromptAnalyses,
} from "./prompt-run";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("buildStartPromptAnalysisPayload", () => {
  test("uses the source prompt id, trims the text, dedupes models and marks the run as manual", () => {
    const payload = buildStartPromptAnalysisPayload({
      projectId: "project-1",
      prompt: {
        id: "prompt-row-1::chatgpt",
        sourcePromptId: "prompt-1",
        prompt: "  Quel CRM faut-il recommander ?  ",
        models: ["gpt-4.1", "claude-4", "gpt-4.1"],
      },
      now: new Date("2026-03-17T09:15:00.000Z"),
    });

    expect(payload).toEqual({
      requestId: "manual:project-1:prompt-1:gpt-4.1,claude-4:2026-03-17T09:15:00.000Z",
      promptTexts: [{ id: "prompt-1", text: "Quel CRM faut-il recommander ?" }],
      modelIds: ["gpt-4.1", "claude-4"],
      runType: "manual",
    });
  });
});

describe("startPromptAnalysis", () => {
  test("posts a manual analysis request for the selected prompt", async () => {
    let capturedUrl = "";
    let capturedHeaders = new Headers();
    let capturedBody = "";

    globalThis.fetch = (async (input, init) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      capturedHeaders = new Headers(init?.headers);
      capturedBody = String(init?.body ?? "");

      return jsonResponse(201, { success: true, data: { id: "run-1" } });
    }) as typeof fetch;

    await startPromptAnalysis({
      apiBaseURL: "https://api.test",
      organizationId: "org-1",
      projectId: "project-1",
      prompt: {
        id: "prompt-1",
        sourcePromptId: "prompt-1",
        prompt: "Comment se positionne Acme face a HubSpot ?",
        models: ["gpt-4.1", "claude-4"],
      },
      now: new Date("2026-03-17T10:30:00.000Z"),
    });

    expect(capturedUrl).toBe("https://api.test/analysis/projects/project-1/analyze");
    expect(capturedHeaders.get("Content-Type")).toBe("application/json");
    expect(capturedHeaders.get("X-Organization-ID")).toBe("org-1");
    expect(JSON.parse(capturedBody)).toEqual({
      requestId: "manual:project-1:prompt-1:gpt-4.1,claude-4:2026-03-17T10:30:00.000Z",
      promptTexts: [
        {
          id: "prompt-1",
          text: "Comment se positionne Acme face a HubSpot ?",
        },
      ],
      modelIds: ["gpt-4.1", "claude-4"],
      runType: "manual",
    });
  });
});

describe("startPromptAnalyses", () => {
  test("sends one manual analysis request per selected prompt row", async () => {
    const capturedBodies: unknown[] = [];

    globalThis.fetch = (async (_input, init) => {
      capturedBodies.push(JSON.parse(String(init?.body ?? "{}")));

      return jsonResponse(201, { success: true, data: { id: `run-${capturedBodies.length}` } });
    }) as typeof fetch;

    await startPromptAnalyses({
      apiBaseURL: "https://api.test",
      organizationId: "org-1",
      projectId: "project-1",
      prompts: [
        {
          id: "prompt-1",
          sourcePromptId: "prompt-1",
          prompt: "Comment Acme est-elle citee ?",
          models: ["gpt-4.1", "claude-4"],
        },
        {
          id: "prompt-2::gemini-2.5",
          sourcePromptId: "prompt-2",
          prompt: "Ou apparait Acme sur Gemini ?",
          models: ["gemini-2.5-pro"],
        },
      ],
      now: new Date("2026-03-17T11:00:00.000Z"),
    });

    expect(capturedBodies).toEqual([
      {
        requestId: "manual:project-1:prompt-1:gpt-4.1,claude-4:2026-03-17T11:00:00.000Z",
        promptTexts: [{ id: "prompt-1", text: "Comment Acme est-elle citee ?" }],
        modelIds: ["gpt-4.1", "claude-4"],
        runType: "manual",
      },
      {
        requestId: "manual:project-1:prompt-2:gemini-2.5-pro:2026-03-17T11:00:00.000Z",
        promptTexts: [{ id: "prompt-2", text: "Ou apparait Acme sur Gemini ?" }],
        modelIds: ["gemini-2.5-pro"],
        runType: "manual",
      },
    ]);
  });
});
