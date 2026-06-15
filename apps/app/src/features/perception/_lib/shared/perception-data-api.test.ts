import { afterEach, describe, expect, test } from "bun:test";

import { loadPerceptionData } from "./perception-data";

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

function mockFetchSequenceWithRequests(responses: Response[]) {
  const requests: Array<{ url: string; organizationId: string | null }> = [];
  let index = 0;

  globalThis.fetch = (async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const headers = new Headers(
      init?.headers ??
      (typeof input === "string" || input instanceof URL ? undefined : input.headers),
    );
    requests.push({
      url,
      organizationId: headers.get("X-Organization-ID"),
    });
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error(`unexpected fetch call #${index}`);
    }
    return response;
  }) as typeof fetch;

  return requests;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("loadPerceptionData", () => {
  test("builds the perception page from backend project and analysis data instead of static Nike defaults", async () => {
    mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: [{ id: "project-1" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME et equipes sales.",
          industry: "B2B CRM",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "ChatGPT",
            provider: "openai",
            groupName: "ChatGPT",
            providerModelId: "gpt-4o-mini",
            iconPath: "/models/chatgpt.svg",
            isEnabledForProject: true,
          },
          {
            id: "claude-3-7-sonnet",
            displayName: "Claude",
            provider: "anthropic",
            groupName: "Claude",
            providerModelId: "claude-3-7-sonnet",
            iconPath: "/models/claude.svg",
            isEnabledForProject: true,
          },
        ],
      }),
      jsonResponse(200, {
        success: true,
        data: [{ id: "cmp-1", name: "HubSpot" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME et equipes sales.",
          useCases: [],
          features: [],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: {
            promptRuns: [
              {
                id: "prompt-run-1",
                promptId: "prompt-1",
                promptText: "Quel CRM recommander pour une PME ?",
              },
              {
                id: "prompt-run-2",
                promptId: "prompt-2",
                promptText: "Compare Acme avec HubSpot.",
              },
            ],
            aiResponses: [
              {
                id: "response-1",
                promptRunId: "prompt-run-1",
                modelId: "gpt-4o-mini",
                rawResponse: "Acme est un CRM pour PME. Voir https://acme.test/pricing",
                brandMentioned: true,
                brandPosition: "top",
                citationFound: true,
                citedUrls: ["https://acme.test/pricing"],
                sentiment: "positive",
                createdAt: "2026-03-04T08:00:00Z",
              },
              {
                id: "response-2",
                promptRunId: "prompt-run-2",
                modelId: "gpt-4o-mini",
                rawResponse: "Acme reste solide face a HubSpot.",
                brandMentioned: true,
                brandPosition: "mid",
                citationFound: false,
                citedUrls: [],
                sentiment: "neutral",
                createdAt: "2026-03-05T10:00:00Z",
              },
              {
                id: "response-3",
                promptRunId: "prompt-run-2",
                modelId: "claude-3-7-sonnet",
                rawResponse: "HubSpot ressort davantage dans cette comparaison.",
                brandMentioned: false,
                brandPosition: "low",
                citationFound: false,
                citedUrls: [],
                sentiment: "negative",
                createdAt: "2026-03-06T12:00:00Z",
              },
            ],
          },
          scores: {
            positioningAccuracy: 67,
            factualAccuracy: 33,
            sentimentScore: 62,
          },
          metadata: {
            generatedAt: "2026-03-06T12:30:00Z",
          },
        },
      }),
    ]);

    const result = await loadPerceptionData("http://api.test", "");

    expect(result.data.brandCanon.brandName).toBe("Acme");
    expect(result.data.brandCanon.shortDescription).toBe("CRM IA pour PME et equipes sales.");
    expect(result.data.brandCanon.category).toBe("B2B CRM");
    expect(result.data.brandCanon.positioning).toBe("CRM IA pour PME et equipes sales.");
    expect(result.data.brandCanon.audience).toEqual([]);
    expect(result.data.brandCanon.useCases).toEqual([]);
    expect(result.data.brandCanon.features).toEqual([]);
    expect(result.data.metadata.models).toEqual(["ChatGPT", "Claude"]);
    expect(result.data.metadata.modelCatalog.map((model) => model.id)).toEqual([
      "gpt-4o-mini",
      "claude-3-7-sonnet",
    ]);
    expect(result.data.metadata.analyzedResponses).toBe(3);
    expect(result.data.modelAxisHeatmap.rows.map((row) => row.model)).toEqual(["ChatGPT", "Claude"]);
    expect(result.data.topErrors).toEqual([]);
    expect(
      result.data.radar.map((point) => [point.axis, point.score]),
    ).toEqual([
      ["positioning", 62],
      ["use_cases", 73],
      ["features", 57],
      ["sentiment", 62],
      ["competitors", 62],
    ]);
    expect(result.data.trend["30d"].data.length > 0).toBe(true);
    expect(JSON.stringify(result.data).includes("Nike")).toBe(false);
  });

  test("loads perception with the bundled dashboard instead of issuing a second dashboard request", async () => {
    const requests = mockFetchSequenceWithRequests([
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME.",
          industry: "B2B CRM",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "ChatGPT",
            provider: "openai",
            groupName: "ChatGPT",
            isEnabledForProject: true,
          },
        ],
      }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME.",
          useCases: [],
          features: [],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: {
            promptRuns: [{ id: "prompt-run-1", promptId: "prompt-1", promptText: "Quel CRM recommander ?" }],
            aiResponses: [
              {
                id: "response-1",
                runId: "run-1",
                promptRunId: "prompt-run-1",
                modelId: "gpt-4o-mini",
                rawResponse: "Acme est recommandee.",
                brandMentioned: true,
                brandPosition: "top",
                citationFound: true,
                citedUrls: ["https://acme.test"],
                sentiment: "positive",
                createdAt: "2026-03-10T08:00:00Z",
              },
            ],
          },
          metadata: {
            generatedAt: "2026-03-10T09:30:00Z",
            projectModels: ["gpt-4o-mini"],
          },
        },
      }),
    ]);

    const result = await loadPerceptionData("http://api.test", "?projectId=project-1");

    expect(result.data.metadata.analyzedResponses).toBe(1);
    expect(requests.some((request) => request.url.includes("/dashboard"))).toBe(false);
    expect(requests.some((request) => request.url.includes("/perception?includeDashboard=1"))).toBe(true);
    expect(requests.some((request) => request.url.includes("/projects/project-1/brand-canon"))).toBe(true);
    expect(requests).toHaveLength(5);
  });

  test("prefers dedicated perception responses over bundled monitoring responses for page analytics", async () => {
    mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME.",
          industry: "B2B CRM",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "ChatGPT",
            provider: "openai",
            groupName: "ChatGPT",
            isEnabledForProject: true,
          },
        ],
      }),
      jsonResponse(200, {
        success: true,
        data: [],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME.",
          useCases: [],
          features: [],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: {
            latestRun: { id: "monitoring-run" },
            promptRuns: [{ id: "prompt-run-1", promptId: "prompt-1", promptText: "Quel CRM recommander ?" }],
            aiResponses: [
              {
                id: "monitoring-response-1",
                runId: "monitoring-run",
                promptRunId: "prompt-run-1",
                modelId: "gpt-4o-mini",
                rawResponse: "Acme est rarement citee.",
                brandMentioned: false,
                brandPosition: "low",
                citationFound: false,
                citedUrls: [],
                sentiment: "negative",
                createdAt: "2026-03-10T08:00:00Z",
              },
            ],
          },
          responses: [
            {
              id: "perception-response-1",
              runId: "perception-run",
              runType: "perception",
              promptRunId: "prompt-run-2",
              modelId: "gpt-4o-mini",
              rawResponse: "Acme est un CRM pertinent pour les PME.",
              brandMentioned: true,
              brandPosition: "top",
              citationFound: true,
              citedUrls: ["https://acme.test"],
              sentiment: "positive",
              createdAt: "2026-03-11T09:00:00Z",
            },
          ],
          scores: {
            positioningAccuracy: 100,
            factualAccuracy: 100,
            sentimentScore: 100,
          },
          metadata: {
            generatedAt: "2026-03-11T09:30:00Z",
            projectModels: ["gpt-4o-mini"],
            sourceMode: "perception_primary",
            perceptionResponses: 1,
            monitoringResponsesUsed: 0,
          },
        },
      }),
    ]);

    const result = await loadPerceptionData("http://api.test", "?projectId=project-1");

    expect(result.data.metadata.sourceMode).toBe("perception_primary");
    expect(result.data.metadata.perceptionResponses).toBe(1);
    expect(result.data.metadata.monitoringResponsesUsed).toBe(1);
    expect(result.data.responses).toHaveLength(2);
    expect(result.data.responses.map((response) => response.id)).toEqual([
      "monitoring-response-1",
      "perception-response-1",
    ]);
    expect(result.data.responses.map((response) => response.runType)).toEqual([
      "monitoring",
      "perception",
    ]);
    expect(result.data.trend["last-run"].data).toHaveLength(1);
    expect(result.data.trend["last-run"].data[0]?.positioning).toBe(100);
  });

  test("sends the selected organization header for project-scoped perception requests", async () => {
    const requests = mockFetchSequenceWithRequests([
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME.",
          industry: "B2B CRM",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "ChatGPT",
            provider: "openai",
            groupName: "ChatGPT",
            isEnabledForProject: true,
          },
        ],
      }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME.",
          useCases: [],
          features: [],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: {
            promptRuns: [],
            aiResponses: [],
          },
          metadata: {
            generatedAt: "2026-03-10T09:30:00Z",
          },
        },
      }),
    ]);

    await loadPerceptionData("http://api.test", "?projectId=project-1&organizationId=org-9");

    expect(requests.map((request) => request.organizationId)).toEqual([
      "org-9",
      "org-9",
      "org-9",
      "org-9",
      "org-9",
    ]);
    expect(requests[0]?.url.includes("/projects/project-1")).toBe(true);
  });

  test("filters perception responses to the currently enabled project models when backend provides them", async () => {
    mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME.",
          industry: "B2B CRM",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "ChatGPT",
            provider: "openai",
            groupName: "ChatGPT",
            isEnabledForProject: true,
          },
          {
            id: "sonar",
            displayName: "Perplexity",
            provider: "perplexity",
            groupName: "Perplexity",
            isEnabledForProject: false,
          },
        ],
      }),
      jsonResponse(200, {
        success: true,
        data: [{ id: "cmp-1", name: "HubSpot" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME.",
          useCases: ["Recommandation CRM"],
          features: ["IA native"],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: {
            promptRuns: [{ id: "prompt-run-1", promptId: "prompt-1", promptText: "Quel CRM recommander ?" }],
            aiResponses: [
              {
                id: "response-1",
                promptRunId: "prompt-run-1",
                modelId: "gpt-4o-mini",
                rawResponse: "Acme est recommandee avec source.",
                brandMentioned: true,
                brandPosition: "top",
                citationFound: true,
                citedUrls: ["https://acme.test"],
                sentiment: "positive",
                createdAt: "2026-03-10T08:00:00Z",
              },
              {
                id: "response-2",
                promptRunId: "prompt-run-1",
                modelId: "sonar",
                rawResponse: "HubSpot est devant Acme.",
                brandMentioned: true,
                brandPosition: "bottom",
                citationFound: false,
                citedUrls: [],
                sentiment: "negative",
                createdAt: "2026-03-10T09:00:00Z",
              },
            ],
          },
          scores: {
            positioningAccuracy: 100,
            factualAccuracy: 100,
            sentimentScore: 100,
          },
          metadata: {
            generatedAt: "2026-03-10T09:30:00Z",
            projectModels: ["gpt-4o-mini"],
            models: ["gpt-4o-mini"],
            responses: 1,
            analyzedResponses: 1,
          },
          topErrors: [
            {
              id: "positioning_gap",
              type: "positioning_gap",
              severity: "medium",
              title: "Le positionnement est encore mal cite",
              issue: "Backend issue",
              impact: "Backend impact",
              detectedInModels: ["gpt-4o-mini"],
              fixType: "website_copy",
              generatedContent: "Backend generated content",
              optimizePriority: "medium",
            },
            {
              id: "citation_gap",
              type: "citation_gap",
              severity: "high",
              title: "Factualite encore fragile",
              issue: "Backend issue 2",
              impact: "Backend impact 2",
              detectedInModels: ["gpt-4o-mini"],
              fixType: "faq_snippet",
              generatedContent: "Backend generated content 2",
              optimizePriority: "high",
            },
            {
              id: "use_case_gap",
              type: "use_case_gap",
              severity: "medium",
              title: "Cas d'usage encore incomplets",
              issue: "Backend issue 3",
              impact: "Backend impact 3",
              detectedInModels: ["gpt-4o-mini"],
              fixType: "website_copy",
              generatedContent: "Backend generated content 3",
              optimizePriority: "medium",
            },
            {
              id: "sentiment_gap",
              type: "sentiment_gap",
              severity: "low",
              title: "Tonalite encore trop neutre",
              issue: "Backend issue 4",
              impact: "Backend impact 4",
              detectedInModels: ["gpt-4o-mini"],
              fixType: "prompt_patch",
              generatedContent: "Backend generated content 4",
              optimizePriority: "low",
            },
          ],
        },
      }),
    ]);

    const result = await loadPerceptionData("http://api.test", "?projectId=project-1");

    expect(result.data.metadata.models).toEqual(["ChatGPT"]);
    expect(result.data.metadata.modelCatalog.map((model) => model.id)).toEqual(["gpt-4o-mini"]);
    expect(result.data.metadata.analyzedResponses).toBe(1);
    expect(result.data.brandCanon.useCases).toEqual(["Recommandation CRM"]);
    expect(result.data.brandCanon.features).toEqual(["IA native"]);
    expect(result.data.responses).toHaveLength(1);
    expect(result.data.responses[0]?.modelId).toBe("gpt-4o-mini");
    expect(result.data.modelAxisHeatmap.rows.map((row) => row.model)).toEqual(["ChatGPT"]);
    expect(result.data.topErrors.map((error) => error.title)).toEqual([
      "Le positionnement est encore mal cite",
      "Factualite encore fragile",
      "Cas d'usage encore incomplets",
      "Tonalite encore trop neutre",
    ]);
  });

  test("resolves a readable project slug from the route before loading perception", async () => {
    mockFetchSequence([
      jsonResponse(404, { error: "not found" }),
      jsonResponse(200, {
        success: true,
        data: [{ id: "prj_1", name: "Site France" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME.",
          industry: "B2B CRM",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "ChatGPT",
            provider: "openai",
            groupName: "ChatGPT",
            isEnabledForProject: true,
          },
        ],
      }),
      jsonResponse(200, { success: true, data: [] }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME.",
          useCases: [],
          features: [],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: { promptRuns: [], aiResponses: [] },
          metadata: {
            generatedAt: "2026-03-10T09:30:00Z",
          },
        },
      }),
    ]);

    const result = await loadPerceptionData("http://api.test", "?project=site-france");

    expect(result.projectId).toBe("prj_1");
    expect(result.data.brandCanon.brandName).toBe("Acme");
  });

  test("falls back to the latest run with active project model responses for score cards and trends", async () => {
    mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME.",
          industry: "B2B CRM",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "ChatGPT",
            provider: "openai",
            groupName: "ChatGPT",
            isEnabledForProject: true,
          },
          {
            id: "sonar",
            displayName: "Perplexity",
            provider: "perplexity",
            groupName: "Perplexity",
            isEnabledForProject: false,
          },
        ],
      }),
      jsonResponse(200, {
        success: true,
        data: [{ id: "cmp-1", name: "HubSpot" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME.",
          useCases: [],
          features: [],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: {
            latestRun: { id: "run-disabled" },
            promptRuns: [{ id: "prompt-run-1", promptId: "prompt-1", promptText: "Quel CRM recommander ?" }],
            aiResponses: [
              {
                id: "response-1",
                runId: "run-enabled",
                promptRunId: "prompt-run-1",
                modelId: "gpt-4o-mini",
                rawResponse: "Acme est recommandee avec source.",
                brandMentioned: true,
                brandPosition: "top",
                citationFound: true,
                citedUrls: ["https://acme.test"],
                sentiment: "positive",
                createdAt: "2026-03-10T08:00:00Z",
              },
              {
                id: "response-2",
                runId: "run-disabled",
                promptRunId: "prompt-run-1",
                modelId: "sonar",
                rawResponse: "HubSpot est devant Acme.",
                brandMentioned: true,
                brandPosition: "bottom",
                citationFound: false,
                citedUrls: [],
                sentiment: "negative",
                createdAt: "2026-03-11T09:00:00Z",
              },
            ],
          },
          scores: {
            positioningAccuracy: 100,
            factualAccuracy: 100,
            sentimentScore: 100,
          },
          metadata: {
            generatedAt: "2026-03-11T09:30:00Z",
            projectModels: ["gpt-4o-mini"],
            models: ["gpt-4o-mini"],
            responses: 1,
            analyzedResponses: 1,
          },
        },
      }),
    ]);

    const result = await loadPerceptionData("http://api.test", "?projectId=project-1");

    expect(result.data.metadata.latestRunId).toBe("run-enabled");
    expect(result.data.trend["last-run"].data).toHaveLength(1);
    expect(result.data.trend["last-run"].data[0]?.positioning).toBe(100);
  });

  test("groups multiple project model variants under the same IA family in perception heatmaps", async () => {
    mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: {
          id: "project-1",
          name: "Acme",
          brandName: "Acme",
          brandDescription: "CRM IA pour PME.",
          industry: "B2B CRM",
          websiteUrl: "https://acme.test",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [
          {
            id: "gpt-4o-mini",
            displayName: "GPT-4o mini",
            provider: "openai",
            groupName: "ChatGPT",
            providerModelId: "openai/gpt-4o-mini",
            isEnabledForProject: true,
          },
          {
            id: "gpt-4.1-mini",
            displayName: "GPT-4.1 mini",
            provider: "openai",
            groupName: "ChatGPT",
            providerModelId: "openai/gpt-4.1-mini",
            isEnabledForProject: true,
          },
        ],
      }),
      jsonResponse(200, {
        success: true,
        data: [],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          brandName: "Acme",
          category: "B2B CRM",
          positioning: "CRM IA pour PME.",
          useCases: [],
          features: [],
          audience: [],
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          dashboard: {
            promptRuns: [{ id: "prompt-run-1", promptId: "prompt-1", promptText: "Quel CRM recommander ?" }],
            aiResponses: [
              {
                id: "response-1",
                runId: "run-1",
                promptRunId: "prompt-run-1",
                modelId: "gpt-4o-mini",
                rawResponse: "Acme est un CRM pertinent.",
                brandMentioned: true,
                brandPosition: "top",
                citationFound: false,
                citedUrls: [],
                sentiment: "positive",
                createdAt: "2026-03-10T08:00:00Z",
              },
              {
                id: "response-2",
                runId: "run-1",
                promptRunId: "prompt-run-1",
                modelId: "gpt-4.1-mini",
                rawResponse: "Acme convient bien aux PME.",
                brandMentioned: true,
                brandPosition: "mid",
                citationFound: false,
                citedUrls: [],
                sentiment: "neutral",
                createdAt: "2026-03-10T08:05:00Z",
              },
            ],
          },
          metadata: {
            generatedAt: "2026-03-10T09:00:00Z",
            projectModels: ["gpt-4o-mini", "gpt-4.1-mini"],
          },
        },
      }),
    ]);

    const result = await loadPerceptionData("http://api.test", "?projectId=project-1");

    expect(result.data.metadata.models).toEqual(["GPT-4o mini", "GPT-4.1 mini"]);
    expect(result.data.metadata.modelCatalog.map((model) => model.groupName)).toEqual([
      "ChatGPT",
      "ChatGPT",
    ]);
    expect(result.data.modelAxisHeatmap.rows.map((row) => row.model)).toEqual(["ChatGPT"]);
  });
});
