import { describe, expect, test } from "bun:test";
import {
  getCatalogDefaultSelection,
  normalizeCatalog,
} from "./catalog-client";

describe("catalog client", () => {
  test("normalizes backend models into the shared frontend catalog shape", () => {
    const catalog = normalizeCatalog({
      success: true,
      data: [
        {
          ID: "gpt-oss-20b-free",
          DisplayName: "gpt-oss-20b (free)",
          GroupName: "gpt-oss",
          Provider: "openai",
          ProviderModelId: "openai/gpt-oss-20b:free",
          IconKey: "openai",
          IconPath: "/models/openai.svg",
          IsActive: true,
          SupportsLiveSearch: false,
        },
      ],
    });

    expect(catalog).toEqual([
      {
        id: "gpt-oss-20b-free",
        name: "gpt-oss-20b (free)",
        modelGroup: "gpt-oss",
        provider: "openai",
        providerModelId: "openai/gpt-oss-20b:free",
        iconKey: "openai",
        icon: "/models/openai.svg",
        description: "openai/gpt-oss-20b:free",
        isActive: true,
        supportsLiveSearch: false,
      },
    ]);
  });

  test("builds onboarding defaults from active catalog models only", () => {
    const selection = getCatalogDefaultSelection(
      [
        {
          id: "gpt-oss-20b-free",
          name: "gpt-oss-20b (free)",
          modelGroup: "gpt-oss",
          provider: "openai",
          providerModelId: "openai/gpt-oss-20b:free",
          iconKey: "openai",
          icon: "/models/openai.svg",
          description: "openai/gpt-oss-20b:free",
          isActive: true,
          supportsLiveSearch: false,
        },
        {
          id: "gemma-3-4b-free",
          name: "Gemma 3 4B (free)",
          modelGroup: "gemma",
          provider: "google",
          providerModelId: "google/gemma-3-4b-it:free",
          iconKey: "google",
          icon: "/models/google.svg",
          description: "google/gemma-3-4b-it:free",
          isActive: true,
          supportsLiveSearch: false,
        },
        {
          id: "disabled-model",
          name: "Disabled",
          modelGroup: "misc",
          provider: "test",
          providerModelId: "disabled",
          iconKey: "test",
          icon: "/models/test.svg",
          description: "disabled",
          isActive: false,
          supportsLiveSearch: false,
        },
      ],
      3,
    );

    expect(selection).toEqual(["gpt-oss-20b-free", "gemma-3-4b-free"]);
  });
});
