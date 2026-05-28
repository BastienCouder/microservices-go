import { describe, expect, test } from "bun:test";

import {
  buildProjectModelFilterItems,
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
