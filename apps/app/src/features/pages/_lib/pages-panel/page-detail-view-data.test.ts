import { describe, expect, test } from "bun:test";

import {
  buildPageCitationSamples,
  buildPageGeoNeed,
  buildPageModelBreakdown,
} from "./page-detail-view-data";
import type { PageInsight } from "./types";

function buildPage(overrides: Partial<PageInsight> = {}): PageInsight {
  return {
    url: "https://example.com/guide",
    hostname: "example.com",
    path: "/guide",
    citationShare: 12.5,
    citationCount: 4,
    promptCount: 3,
    modelCount: 2,
    models: [
      { id: "openai", label: "OpenAI", iconPath: "/models/openai.svg" },
      { id: "perplexity", label: "Perplexity", iconPath: "/models/perplexity.svg" },
    ],
    personas: ["CEO"],
    samples: [
      {
        id: "response-1",
        prompt: "Quel outil choisir ?",
        response: "Example est cite.",
        promptId: "prompt-1",
        responseId: "response-1",
        model: { id: "openai", label: "OpenAI", iconPath: "/models/openai.svg" },
        persona: "CEO",
        time: "10:00",
        citationCount: 2,
      },
      {
        id: "response-2",
        prompt: "Quel outil choisir ?",
        response: "Example est cite aussi.",
        promptId: "prompt-2",
        responseId: "response-2",
        model: { id: "openai", label: "OpenAI", iconPath: "/models/openai.svg" },
        persona: "CEO",
        time: "10:05",
        citationCount: 1,
      },
      {
        id: "response-3",
        prompt: "Quels concurrents comparer ?",
        response: "Example ressort.",
        promptId: "prompt-3",
        responseId: "response-3",
        model: { id: "perplexity", label: "Perplexity", iconPath: "/models/perplexity.svg" },
        persona: "CEO",
        time: "10:10",
        citationCount: 1,
      },
    ],
    ...overrides,
  };
}

describe("page detail view data", () => {
  test("aggregates cited responses and citations by LLM", () => {
    const breakdown = buildPageModelBreakdown(buildPage());

    expect(breakdown).toEqual([
      {
        id: "openai",
        label: "OpenAI",
        iconPath: "/models/openai.svg",
        responseCount: 2,
        citationCount: 3,
        coverageShare: 66.7,
      },
      {
        id: "perplexity",
        label: "Perplexity",
        iconPath: "/models/perplexity.svg",
        responseCount: 1,
        citationCount: 1,
        coverageShare: 33.3,
      },
    ]);
  });

  test("returns one GEO need only when the page has an actionable signal", () => {
    expect(buildPageGeoNeed(buildPage({ modelCount: 1 }))).toEqual({
      title: "Diversifier la reprise LLM",
      description:
        "Cette page est encore reprise par un seul modèle. Renforcez les preuves, les comparatifs et les formulations explicites pour augmenter sa couverture multi-LLM.",
      metric: "1 LLM",
      tone: "warning",
    });

    expect(
      buildPageGeoNeed(
        buildPage({
          citationShare: 4,
          citationCount: 1,
          promptCount: 1,
          modelCount: 2,
        }),
      ),
    ).toBe(null);
  });

  test("deduplicates repeated citation samples before rendering details", () => {
    const page = buildPage({
      samples: [
        {
          id: "response-1-page",
          prompt: "Quel outil choisir ?",
          response: "Example est cite.",
          promptId: "prompt-1",
          responseId: "response-1",
          model: { id: "openai", label: "OpenAI", iconPath: "/models/openai.svg" },
          persona: "CEO",
          time: "10:00",
          citationCount: 2,
        },
        {
          id: "duplicate-response-1-page",
          prompt: "Quel outil choisir ?",
          response: "Example est cite.",
          promptId: "prompt-1",
          responseId: "response-1",
          model: { id: "openai", label: "OpenAI", iconPath: "/models/openai.svg" },
          persona: "CEO",
          time: "10:00",
          citationCount: 2,
        },
      ],
    });

    const samples = buildPageCitationSamples(page);

    expect(samples).toHaveLength(1);
    expect(samples[0]?.detailKey).toBe("response-1");
  });
});
