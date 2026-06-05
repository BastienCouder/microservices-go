import { describe, expect, test } from "bun:test";

import {
  buildProjectModelFilterItems,
  normalizeModelPayload,
  type ProjectModelMeta,
} from "./project-models";

const models: ProjectModelMeta[] = [
  {
    id: "zeta",
    displayName: "Aardvark 2",
    provider: "provider",
    groupName: "Zeta",
    providerModelId: "zeta-2",
    description: "",
    iconPath: "",
    live: true,
    creditCost: 1,
  },
  {
    id: "alpha-2",
    displayName: "Alpha 2",
    provider: "provider",
    groupName: "Alpha",
    providerModelId: "alpha-2",
    description: "",
    iconPath: "",
    live: true,
    creditCost: 1,
  },
  {
    id: "alpha-10",
    displayName: "Alpha 10",
    provider: "provider",
    groupName: "Alpha",
    providerModelId: "alpha-10",
    description: "",
    iconPath: "",
    live: true,
    creditCost: 1,
  },
  {
    id: "beta",
    displayName: "Beta",
    provider: "provider",
    groupName: "Beta",
    providerModelId: "beta",
    description: "",
    iconPath: "",
    live: false,
    creditCost: 1,
  },
];

describe("project model filters", () => {
  test("sorts grouped model filters alphabetically and ignores inactive models", () => {
    expect(buildProjectModelFilterItems(models, false).map((item) => item.groupName)).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });

  test("sorts unique model filters alphabetically with natural numeric ordering", () => {
    expect(buildProjectModelFilterItems(models, true).map((item) => item.displayName)).toEqual([
      "Alpha 2",
      "Alpha 10",
      "Aardvark 2",
    ]);
  });
});

describe("project model payloads", () => {
  test("normalizes model credit cost from API payloads", () => {
    expect(
      normalizeModelPayload({
        id: "anthropic-claude-opus-4-5",
        displayName: "Claude Opus 4.5",
        provider: "anthropic",
        groupName: "Anthropic",
        providerModelId: "anthropic/claude-opus-4.5",
        creditCost: 2,
        inputPricePerMillion: 5,
        outputPricePerMillion: 25,
        openRouterPricing: { prompt: "0.000005", completion: "0.000025" },
      })?.creditCost,
    ).toBe(2);

    const model = normalizeModelPayload({
      id: "anthropic-claude-opus-4-5",
      providerModelId: "anthropic/claude-opus-4.5",
      inputPricePerMillion: 5,
      outputPricePerMillion: 25,
      openRouterPricing: { prompt: "0.000005", completion: "0.000025" },
    });

    expect(model?.inputPricePerMillion).toBe(5);
    expect(model?.outputPricePerMillion).toBe(25);
    expect(model?.openRouterPricing).toEqual({
      prompt: "0.000005",
      completion: "0.000025",
    });
  });
});
