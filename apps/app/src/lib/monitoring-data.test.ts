import { afterEach, describe, expect, test } from "bun:test";

import { filterMonitoringAlerts, loadMonitoringData } from "./monitoring-data";

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

describe("loadMonitoringData", () => {
  test("throws when the projects request fails instead of returning an empty monitoring", async () => {
    mockFetchSequence([
      jsonResponse(500, { error: "db offline" }),
    ]);

    await expect(loadMonitoringData("http://api.test", "")).rejects.toThrow();
  });

  test("does not invent a synthetic persona when the backend does not provide one", async () => {
    mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "project-1" }] }),
      jsonResponse(200, { success: true, data: { id: "project-1", brandName: "Acme" } }),
      jsonResponse(200, { success: true, data: [{ id: "chatgpt", displayName: "ChatGPT", provider: "openai", isEnabledForProject: true }] }),
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

    const result = await loadMonitoringData("http://api.test", "");

    expect(result.data.recent_prompts).toHaveLength(1);
    expect(result.data.recent_prompts[0]?.persona).toBe("");
  });

  test("aligns response score with backend visibility formula for a top mention without citation", async () => {
    mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "project-1" }] }),
      jsonResponse(200, { success: true, data: { id: "project-1", brandName: "Nike" } }),
      jsonResponse(200, { success: true, data: [{ id: "chatgpt", displayName: "ChatGPT", provider: "openai", isEnabledForProject: true }] }),
      jsonResponse(200, { success: true, data: [{ name: "ASICS" }, { name: "Adidas" }] }),
      jsonResponse(200, {
        success: true,
        data: {
          promptRuns: [{ id: "run-1", promptId: "prompt-1", promptText: "Quelles sneakers lifestyle iconiques recommandes-tu ?" }],
          aiResponses: [
            {
              id: "resp-1",
              promptRunId: "run-1",
              modelId: "chatgpt",
              rawResponse: "Nike reste la marque la plus recommandee. Adidas suit de pres.",
              createdAt: "2026-03-05T09:00:00Z",
              brandMentioned: true,
              brandPosition: "top",
              citationFound: false,
              sentiment: "neutral",
            },
          ],
        },
      }),
      jsonResponse(200, { success: true, data: [] }),
    ]);

    const result = await loadMonitoringData("http://api.test", "");

    expect(result.data.recent_prompts).toHaveLength(1);
    expect(result.data.recent_prompts[0]?.score).toBe(70);
    expect(result.data.recent_prompts[0]?.competitorsMentioned).toEqual(["Adidas"]);
  });

  test("does not count subdomain citations as project-domain citations", async () => {
    mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "project-1" }] }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          brandName: "Acme",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, { success: true, data: [{ id: "chatgpt", displayName: "ChatGPT", provider: "openai", isEnabledForProject: true }] }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, {
        success: true,
        data: {
          promptRuns: [{ id: "run-1", promptId: "prompt-1", promptText: "What is Acme?" }],
          aiResponses: [
            {
              id: "resp-1",
              promptRunId: "run-1",
              modelId: "chatgpt",
              rawResponse: "Acme is mentioned with a support link.",
              createdAt: "2026-03-05T09:00:00Z",
              brandMentioned: true,
              citationFound: true,
              citedUrls: ["https://support.acme.test/help"],
            },
          ],
        },
      }),
      jsonResponse(200, { success: true, data: [] }),
    ]);

    const result = await loadMonitoringData("http://api.test", "");
    const prompt = result.data.recent_prompts[0];

    expect(prompt?.citationFound).toBe(false);
    expect(prompt?.citedUrls).toEqual([]);
    expect(prompt?.allCitedUrls).toEqual(["https://support.acme.test/help"]);
    expect(prompt?.score).toBe(50);
    expect(result.data.pagesStats.pages).toEqual([]);
  });

  test("resolves a readable project slug from the route before loading monitoring", async () => {
    mockFetchSequence([
      jsonResponse(404, { error: "not found" }),
      jsonResponse(200, {
        success: true,
        data: [
          { id: "prj_1", name: "Site France" },
          { id: "prj_2", name: "Site Europe" },
        ],
      }),
      jsonResponse(200, { success: true, data: { id: "prj_1", brandName: "Acme", name: "Site France" } }),
      jsonResponse(200, { success: true, data: [{ id: "chatgpt", displayName: "ChatGPT", provider: "openai", isEnabledForProject: true }] }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, { success: true, data: { promptRuns: [], aiResponses: [] } }),
      jsonResponse(200, { success: true, data: [] }),
    ]);

    const result = await loadMonitoringData("http://api.test", "?project=site-france");

    expect(result.projectId).toBe("prj_1");
    expect(result.data.project.name).toBe("Acme");
  });

  test("resolves a readable project slug after a project access denied response", async () => {
    mockFetchSequence([
      jsonResponse(401, { error: "unauthorized: project access denied" }),
      jsonResponse(200, {
        success: true,
        data: [
          { id: "prj_1", name: "Site France" },
          { id: "prj_2", name: "Site Europe" },
        ],
      }),
      jsonResponse(200, { success: true, data: { id: "prj_1", brandName: "Acme", name: "Site France" } }),
      jsonResponse(200, { success: true, data: [{ id: "chatgpt", displayName: "ChatGPT", provider: "openai", isEnabledForProject: true }] }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, { success: true, data: { promptRuns: [], aiResponses: [] } }),
      jsonResponse(200, { success: true, data: [] }),
    ]);

    const result = await loadMonitoringData("http://api.test", "?project=site-france");

    expect(result.projectId).toBe("prj_1");
    expect(result.data.project.name).toBe("Acme");
  });

  test("maps provider model ids back to the enabled project model id for prompts responses", async () => {
    mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "project-1" }] }),
      jsonResponse(200, { success: true, data: { id: "project-1", brandName: "Acme" } }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gemma-3-4b-free",
            displayName: "Gemma 3 4B",
            groupName: "gemma",
            provider: "google",
            providerModelId: "google/gemma-3-4b-it",
            isEnabledForProject: true,
          },
        ],
      }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, {
        success: true,
        data: {
          promptRuns: [{ id: "run-1", promptId: "prompt-1", promptText: "Quel outil choisir ?" }],
          aiResponses: [
            {
              id: "resp-1",
              promptRunId: "run-1",
              modelId: "google/gemma-3-4b-it",
              rawResponse: "Acme est souvent recommande.",
              createdAt: "2026-03-05T09:00:00Z",
              brandMentioned: true,
            },
          ],
        },
      }),
      jsonResponse(200, { success: true, data: [] }),
    ]);

    const result = await loadMonitoringData("http://api.test", "");

    expect(result.data.recent_prompts).toHaveLength(1);
    const recentPrompt = result.data.recent_prompts[0];
    expect(recentPrompt.modelId).toBe("gemma-3-4b-free");
    expect(recentPrompt.modelDisplayName).toBe("Gemma 3 4B");
    expect(recentPrompt.modelGroupName).toBe("gemma");
    expect(recentPrompt.modelProviderModelId).toBe("google/gemma-3-4b-it");
  });
});

describe("filterMonitoringAlerts", () => {
  test("hides alerts that cannot be scoped when audience filters are active", () => {
    const filtered = filterMonitoringAlerts(
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
