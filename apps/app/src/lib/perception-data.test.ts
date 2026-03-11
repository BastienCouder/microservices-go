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
        data: {
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
      }),
      jsonResponse(200, {
        success: true,
        data: {
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
    expect(result.data.brandCanon.category).toBe("B2B CRM");
    expect(result.data.brandCanon.positioning).toBe("CRM IA pour PME et equipes sales.");
    expect(result.data.brandCanon.audience).toEqual([]);
    expect(result.data.brandCanon.useCases).toEqual([]);
    expect(result.data.brandCanon.features).toEqual([]);
    expect(result.data.metadata.models).toEqual(["ChatGPT", "Claude"]);
    expect(result.data.metadata.analyzedResponses).toBe(3);
    expect(result.data.modelAxisHeatmap.rows.map((row) => row.model)).toEqual(["ChatGPT", "Claude"]);
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
});
