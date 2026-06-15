import { describe, expect, test } from "bun:test";

import { buildPromptPageItems, buildResponseRows } from "./prompt-data-factory";

describe("buildPromptPageItems", () => {
  test("prefers persisted prompt modelIds over historical run models", () => {
    const items = buildPromptPageItems({
      projectPrompts: [
        {
          id: "prompt-1",
          text: "Quel CRM ?",
          modelIds: ["google-gemma-4-26b-a4b-it-free"],
          schedule: {
            mode: "global",
            cron: "0 */6 * * *",
            timezone: "UTC",
            modelCrons: {},
          },
          isActive: true,
        },
      ],
      recentPrompts: [
        {
          responseId: "resp-1",
          promptId: "prompt-1",
          text: "Quel CRM ?",
          prompt: "Quel CRM ?",
          modelId: "gpt-oss-120b-free",
          modelGroupName: "gpt-oss",
          modelDisplayName: "gpt-oss-120b",
          modelProviderModelId: "openai/gpt-oss-120b:free",
          time: "10m",
          mention: true,
          sentiment: "positive",
          score: 90,
          response: "Acme est visible",
          competitorsMentioned: [],
        },
      ] as never,
      competitors: [],
      availableModels: ["google-gemma-4-26b-a4b-it-free", "gpt-oss-120b-free"],
      stages: ["Awareness", "Consideration", "Decision"],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.models).toEqual(["google-gemma-4-26b-a4b-it-free"]);
  });

  test("does not invent a main competitor when the response cites none", () => {
    const rows = buildResponseRows({
      recentPrompts: [
        {
          responseId: "resp-1",
          promptId: "prompt-1",
          text: "Quelle sneaker lifestyle iconique choisir ?",
          prompt: "Quelle sneaker lifestyle iconique choisir ?",
          modelId: "gpt-oss-120b-free",
          modelGroupName: "gpt-oss",
          modelDisplayName: "gpt-oss-120b",
          modelProviderModelId: "openai/gpt-oss-120b:free",
          time: "10m",
          mention: true,
          sentiment: "neutral",
          score: 70,
          response: "Nike reste la marque la plus recommandee sur ce segment.",
          competitorsMentioned: [],
        },
      ] as never,
      competitors: [{ name: "ASICS" }, { name: "Adidas" }],
      availableModels: ["gpt-oss-120b-free"],
      stages: ["Awareness", "Consideration", "Decision"],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.competitor).toBe("Aucun");
    expect(rows[0]?.competitors).toEqual([]);
    expect(rows[0]?.sentiment).toBe("neutral");
    expect(rows[0]?.highlights.includes("Aucun concurrent detecte")).toBe(true);
  });
});
