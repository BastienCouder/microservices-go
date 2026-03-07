import { afterEach, describe, expect, test } from "bun:test";

import { filterDashboardAlerts, loadDashboardData } from "./dashboard-data";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchSequence(responses: Response[]) {
  let index = 0;
  globalThis.fetch = (async () => {
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error(`unexpected fetch call #${index}`);
    }
    return response;
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("loadDashboardData", () => {
  test("throws when the projects request fails instead of returning an empty dashboard", async () => {
    mockFetchSequence([
      jsonResponse(500, { error: "db offline" }),
    ]);

    await expect(loadDashboardData("http://api.test", "")).rejects.toThrow();
  });

  test("does not invent a synthetic persona when the backend does not provide one", async () => {
    mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "project-1" }] }),
      jsonResponse(200, { success: true, data: { id: "project-1", brandName: "Acme" } }),
      jsonResponse(200, { success: true, data: [{ id: "chatgpt", name: "ChatGPT", provider: "openai" }] }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, {
        success: true,
        data: {
          promptRuns: [{ id: "run-1", promptText: "What is Acme?" }],
          aiResponses: [
            {
              promptRunId: "run-1",
              modelId: "chatgpt",
              rawResponse: "Acme is a company",
              createdAt: "2026-03-05T09:00:00Z",
              brandMentioned: true,
            },
          ],
        },
      }),
      jsonResponse(200, { success: true, data: [] }),
    ]);

    const result = await loadDashboardData("http://api.test", "");

    expect(result.data.recent_prompts).toHaveLength(1);
    expect(result.data.recent_prompts[0]?.persona).toBe("");
  });
});

describe("filterDashboardAlerts", () => {
  test("hides alerts that cannot be scoped when audience filters are active", () => {
    const filtered = filterDashboardAlerts(
      [
        {
          type: "warning",
          prompts: "visibility_drop",
          msg: "Drop detected",
          time: "2h",
          isRead: false,
          createdAt: "2026-03-05T10:00:00Z",
        },
      ],
      {
        period: "7d",
        dateRange: undefined,
        selectedModels: ["chatgpt"],
        selectedPersonas: [],
        selectedCompetitors: [],
      },
    );

    expect(filtered).toEqual([]);
  });
});
