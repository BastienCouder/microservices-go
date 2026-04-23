import { describe, expect, test } from "bun:test";

import type { MonitoringModel } from "./types";
import { buildVisibleModelFilterItems } from "./filter-helpers";

function makeModel(overrides: Partial<MonitoringModel>): MonitoringModel {
  return {
    id: "model-id",
    displayName: "Model",
    provider: "openai",
    groupName: "Group",
    providerModelId: "provider/model",
    description: "",
    iconPath: "/models/openai.svg",
    live: true,
    ...overrides,
  };
}

describe("buildVisibleModelFilterItems", () => {
  test("sorts grouped model filters alphabetically by group name", () => {
    const models: MonitoringModel[] = [
      makeModel({ id: "zeus-1", displayName: "Zeus 1", groupName: "Zeus" }),
      makeModel({ id: "apollo-1", displayName: "Apollo 1", groupName: "Apollo" }),
      makeModel({ id: "hermes-1", displayName: "Hermes 1", groupName: "Hermes" }),
      makeModel({ id: "apollo-2", displayName: "Apollo 2", groupName: "Apollo" }),
    ];

    const items = buildVisibleModelFilterItems(models, false);

    expect(items.map((item) => item.id)).toEqual(["Apollo", "Hermes", "Zeus"]);
  });

  test("sorts unique model filters alphabetically by display name", () => {
    const models: MonitoringModel[] = [
      makeModel({ id: "zulu", displayName: "Zulu", groupName: "ChatGPT" }),
      makeModel({ id: "alpha", displayName: "Alpha", groupName: "Claude" }),
      makeModel({ id: "beta", displayName: "Beta", groupName: "ChatGPT" }),
      makeModel({ id: "offline", displayName: "Offline", live: false }),
    ];

    const items = buildVisibleModelFilterItems(models, true);

    expect(items.map((item) => item.id)).toEqual(["alpha", "beta", "zulu"]);
  });
});
