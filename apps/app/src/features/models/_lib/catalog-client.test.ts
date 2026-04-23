import { afterEach, describe, expect, test } from "bun:test";
import { apiRoutes } from "@/lib/api-config";
import {
  buildProviderLabel,
  filterModelCatalogForAdmin,
  deleteLLMProviderCredential,
  getProviderCredentialOptions,
  getProviderKeyRequirements,
  getCatalogDefaultSelection,
  isProviderUsableWithCredentials,
  normalizeCatalog,
  normalizeCatalogMutationItem,
  normalizeLLMProviderCredentials,
  sortCatalogItemsByProvider,
} from "./catalog-client";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("catalog client", () => {
  test("builds an explicit inactive-inclusive catalog route", () => {
    expect(apiRoutes.aiModels.list(false)).toBe(
      "/projects/ai-models?active_only=false",
    );
  });

  test("normalizes supported OpenRouter provider aliases for display", () => {
    expect(buildProviderLabel("meta-llama")).toBe("Meta");
    expect(buildProviderLabel("qwen-color")).toBe("Qwen");
    expect(buildProviderLabel("z-ai")).toBe("Z.ai");
    expect(buildProviderLabel("grok")).toBe("xAI");
    expect(buildProviderLabel("antropic")).toBe("Anthropic");
  });

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

  test("normalizes enveloped catalogue mutations", () => {
    expect(
      normalizeCatalogMutationItem({
        success: true,
        data: {
          id: "openai-o3",
          displayName: "OpenAI o3",
          provider: "openai",
          groupName: "chatgpt",
          iconKey: "openai",
          providerModelId: "o3",
          iconPath: "/models/openai.svg",
          isActive: true,
          supportsLiveSearch: false,
        },
      }),
    ).toEqual({
      id: "openai-o3",
      name: "OpenAI o3",
      modelGroup: "chatgpt",
      provider: "openai",
      providerModelId: "o3",
      iconKey: "openai",
      icon: "/models/openai.svg",
      description: "o3",
      isActive: true,
      supportsLiveSearch: false,
    });
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

  test("builds provider key requirements from the selected model providers", () => {
    const requirements = getProviderKeyRequirements(
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
          id: "claude-sonnet",
          name: "Claude Sonnet",
          modelGroup: "claude",
          provider: "anthropic",
          providerModelId: "anthropic/claude-sonnet",
          iconKey: "claude",
          icon: "/models/claude.svg",
          description: "anthropic/claude-sonnet",
          isActive: true,
          supportsLiveSearch: false,
        },
        {
          id: "disabled-google",
          name: "Disabled Google",
          modelGroup: "gemini",
          provider: "google",
          providerModelId: "google/gemini",
          iconKey: "google",
          icon: "/models/google.svg",
          description: "google/gemini",
          isActive: false,
          supportsLiveSearch: false,
        },
      ],
      ["gpt-oss-20b-free", "claude-sonnet"],
      [
        {
          provider: "openai",
          label: "OpenAI",
          hasApiKey: true,
          updatedAt: "2026-04-21T08:00:00Z",
        },
      ],
    );

    expect(requirements).toEqual([
      {
        provider: "openai",
        label: "OpenAI",
        hasApiKey: true,
        updatedAt: "2026-04-21T08:00:00Z",
      },
      {
        provider: "anthropic",
        label: "Anthropic",
        hasApiKey: false,
        updatedAt: "",
      },
    ]);
  });

  test("normalizes provider credential status envelopes", () => {
    expect(
      normalizeLLMProviderCredentials({
        success: true,
        data: [
          {
            Provider: "openai",
            Label: "OpenAI",
            HasAPIKey: true,
            UpdatedAt: "2026-04-21T08:00:00Z",
          },
          {
            provider: "google",
            has_api_key: false,
          },
        ],
      }),
    ).toEqual([
      {
        provider: "openai",
        label: "OpenAI",
        hasApiKey: true,
        updatedAt: "2026-04-21T08:00:00Z",
      },
      {
        provider: "google",
        label: "Google Gemini",
        hasApiKey: false,
        updatedAt: "",
      },
    ]);
  });

  test("normalizes a single provider credential payload", () => {
    expect(
      normalizeLLMProviderCredentials({
        success: true,
        data: {
          provider: "openai",
          hasApiKey: true,
          updatedAt: "2026-04-21T13:39:28.53912194Z",
        },
      }),
    ).toEqual([
      {
        provider: "openai",
        label: "OpenAI",
        hasApiKey: true,
        updatedAt: "2026-04-21T13:39:28.53912194Z",
      },
    ]);
  });

  test("deletes a provider credential and normalizes the response payload", async () => {
    const requests: Request[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return jsonResponse(200, {
        success: true,
        data: {
          provider: "openai",
          hasApiKey: false,
          updatedAt: "2026-04-21T14:00:00Z",
        },
      });
    }) as typeof fetch;

    const credential = await deleteLLMProviderCredential(
      "http://api.test",
      "42",
      "project-1",
      "openai",
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("DELETE");
    expect(requests[0]?.url).toBe(
      "http://api.test/projects/project-1/llm-provider-credentials/openai",
    );
    expect(credential).toEqual({
      provider: "openai",
      label: "OpenAI",
      hasApiKey: false,
      updatedAt: "2026-04-21T14:00:00Z",
    });
  });

  test("does not require provider keys before a model is selected", () => {
    expect(
      getProviderKeyRequirements(
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
        ],
        [],
      ),
    ).toEqual([]);
  });

  test("builds configurable provider cards from active catalog providers only", () => {
    const providers = getProviderCredentialOptions(
      [
        {
          id: "deepseek-chat",
          name: "DeepSeek Chat",
          modelGroup: "deepseek",
          provider: "deepseek",
          providerModelId: "deepseek/deepseek-chat",
          iconKey: "deepseek",
          icon: "/models/openai.svg",
          description: "deepseek/deepseek-chat",
          isActive: true,
          supportsLiveSearch: false,
        },
        {
          id: "custom-model",
          name: "Custom",
          modelGroup: "custom",
          provider: "custom-provider",
          providerModelId: "custom/model",
          iconKey: "custom",
          icon: "/models/openai.svg",
          description: "custom/model",
          isActive: true,
          supportsLiveSearch: false,
        },
        {
          id: "mistral-disabled",
          name: "Mistral disabled",
          modelGroup: "mistral",
          provider: "mistral",
          providerModelId: "mistral/disabled",
          iconKey: "mistral",
          icon: "/models/mistral.svg",
          description: "mistral/disabled",
          isActive: false,
          supportsLiveSearch: false,
        },
      ],
      [
        {
          provider: "openrouter",
          label: "OpenRouter",
          hasApiKey: true,
          updatedAt: "2026-04-21T08:00:00Z",
        },
      ],
    );

    const providerIds = providers.map((provider) => provider.provider);

    expect(providerIds.includes("openrouter")).toBe(true);
    expect(providerIds.includes("deepseek")).toBe(true);
    expect(providerIds.includes("custom-provider")).toBe(true);
    expect(providerIds.includes("mistral")).toBe(false);
    expect(providerIds.includes("openai")).toBe(false);
    expect(
      providers.find((provider) => provider.provider === "openrouter")
        ?.hasApiKey,
    ).toBe(true);
  });

  test("does not show provider cards when no model is active", () => {
    expect(
      getProviderCredentialOptions([
        {
          id: "openai-disabled",
          name: "OpenAI disabled",
          modelGroup: "gpt",
          provider: "openai",
          providerModelId: "openai/disabled",
          iconKey: "openai",
          icon: "/models/openai.svg",
          description: "openai/disabled",
          isActive: false,
          supportsLiveSearch: false,
        },
      ]),
    ).toEqual([]);
  });

  test("filters the admin model catalog by status, provider and search", () => {
    const filtered = filterModelCatalogForAdmin(
      [
        {
          id: "openai-gpt-4o-mini",
          name: "GPT-4o mini",
          modelGroup: "gpt-4o",
          provider: "openai",
          providerModelId: "openai/gpt-4o-mini",
          iconKey: "openai",
          icon: "/models/openai.svg",
          description: "openai/gpt-4o-mini",
          isActive: true,
          supportsLiveSearch: false,
        },
        {
          id: "openai-gpt-4o-search",
          name: "GPT-4o Search",
          modelGroup: "gpt-4o",
          provider: "openai",
          providerModelId: "openai/gpt-4o-search",
          iconKey: "openai",
          icon: "/models/openai.svg",
          description: "openai/gpt-4o-search",
          isActive: false,
          supportsLiveSearch: true,
        },
        {
          id: "anthropic-claude",
          name: "Claude Sonnet",
          modelGroup: "claude",
          provider: "anthropic",
          providerModelId: "anthropic/claude-sonnet",
          iconKey: "anthropic",
          icon: "/models/anthropic.svg",
          description: "anthropic/claude-sonnet",
          isActive: true,
          supportsLiveSearch: false,
        },
      ],
      {
        provider: "openai",
        search: "search",
        status: "inactive",
        supportsLiveSearch: true,
      },
    );

    expect(filtered.map((model) => model.id)).toEqual(["openai-gpt-4o-search"]);
  });

  test("sorts models alphabetically by provider", () => {
    const sorted = sortCatalogItemsByProvider([
      {
        id: "z-model",
        name: "Alpha",
        modelGroup: "misc",
        provider: "openai",
        providerModelId: "zeta",
        iconKey: "openai",
        icon: "/models/openai.svg",
        description: "zeta",
        isActive: true,
        supportsLiveSearch: false,
      },
      {
        id: "a-model",
        name: "Zeta",
        modelGroup: "misc",
        provider: "anthropic",
        providerModelId: "alpha",
        iconKey: "anthropic",
        icon: "/models/anthropic.svg",
        description: "alpha",
        isActive: true,
        supportsLiveSearch: false,
      },
    ]);

    expect(sorted.map((model) => model.id)).toEqual(["a-model", "z-model"]);
  });

  test("marks a provider usable from its own key or from OpenRouter", () => {
    expect(
      isProviderUsableWithCredentials("anthropic", [
        {
          provider: "openrouter",
          label: "OpenRouter",
          hasApiKey: true,
          updatedAt: "2026-04-21T08:00:00Z",
        },
      ]),
    ).toBe(true);

    expect(
      isProviderUsableWithCredentials("google", [
        {
          provider: "openai",
          label: "OpenAI",
          hasApiKey: true,
          updatedAt: "2026-04-21T08:00:00Z",
        },
      ]),
    ).toBe(false);
  });

  test("treats OpenRouter as coverage for selected provider requirements", () => {
    const requirements = getProviderKeyRequirements(
      [
        {
          id: "claude-sonnet",
          name: "Claude Sonnet",
          modelGroup: "claude",
          provider: "anthropic",
          providerModelId: "anthropic/claude-sonnet",
          iconKey: "anthropic",
          icon: "/models/anthropic.svg",
          description: "anthropic/claude-sonnet",
          isActive: true,
          supportsLiveSearch: false,
        },
      ],
      ["claude-sonnet"],
      [
        {
          provider: "openrouter",
          label: "OpenRouter",
          hasApiKey: true,
          updatedAt: "2026-04-21T08:00:00Z",
        },
      ],
    );

    expect(requirements).toEqual([
      {
        provider: "anthropic",
        label: "Anthropic",
        hasApiKey: true,
        updatedAt: "2026-04-21T08:00:00Z",
      },
    ]);
  });
});
