"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  buildProviderLabel,
  buildProjectModelLookup,
  toProjectModelVisual,
  type ProjectModelMeta,
} from "@/lib/project-models";
import { appQueryKeys } from "@/lib/query-keys";
import { buildPromptPageItems } from "./prompt-data-factory";
import { loadAllPromptPages } from "./prompt-api";
import { dedupeModels } from "./prompt-normalizers";
import { normalizeModelName, STAGES } from "./utils";
import type {
  ModelVisual,
  ProjectPromptRecord,
  PromptSort,
  PromptSortDirection,
} from "./types";

const PROVIDER_VISUALS = [
  {
    keys: ["openai", "chatgpt", "gpt", "o1", "o3", "o4"],
    provider: "OpenAI",
    icon: "/models/openai.svg",
  },
  {
    keys: ["google", "gemini", "gemma"],
    provider: "Google",
    icon: "/models/google.svg",
  },
  {
    keys: ["anthropic", "claude"],
    provider: "Anthropic",
    icon: "/models/anthropic.svg",
  },
  {
    keys: ["perplexity"],
    provider: "Perplexity",
    icon: "/models/perplexity.svg",
  },
  {
    keys: ["mistral"],
    provider: "Mistral",
    icon: "/models/mistral.svg",
  },
  {
    keys: ["microsoft", "copilot"],
    provider: "Microsoft",
    icon: "/models/copilot.svg",
  },
  {
    keys: ["xai", "grok"],
    provider: "xAI",
    icon: "/models/xai.svg",
  },
  {
    keys: ["deepseek"],
    provider: "DeepSeek",
    icon: "/models/deepseek.svg",
  },
  {
    keys: ["qwen"],
    provider: "Qwen",
    icon: "/models/qwen.svg",
  },
  {
    keys: ["meta", "llama"],
    provider: "Meta",
    icon: "/models/meta.svg",
  },
  {
    keys: ["groq"],
    provider: "Groq",
    icon: "/models/groq.svg",
  },
  {
    keys: ["openrouter"],
    provider: "OpenRouter",
    icon: "/models/openrouter.svg",
  },
  {
    keys: ["z.ai", "zai"],
    provider: "Z.ai",
    icon: "/models/zai.svg",
  },
] as const;

function getProviderModelName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const pathParts = trimmed.split("/").filter(Boolean);
  const lastPathPart = pathParts.at(-1) ?? trimmed;

  return lastPathPart.trim();
}

function findProviderVisual(...values: string[]) {
  const haystack = values
    .map((value) => normalizeModelName(value))
    .filter(Boolean)
    .join(" ");

  if (!haystack) return null;

  return (
    PROVIDER_VISUALS.find(({ keys }) =>
      keys.some((key) => haystack.includes(key)),
    ) ?? null
  );
}

type MonitoringDataShape = {
  project: {
    id: string;
    competitors: Array<{ name: string }>;
  };
  models: ProjectModelMeta[];
  recent_prompts: Array<{
    persona?: string | null;
    modelId?: string;
    modelProviderModelId?: string;
    modelDisplayName?: string;
    modelGroupName?: string;
  }>;
};

type UsePromptsSourceDataParams = {
  apiBaseURL: string;
  organizationId: string;
  monitoringData: MonitoringDataShape;
  projectId: string | null;
  deferredSearch: string;
  promptSort: PromptSort;
  promptSortDirection: PromptSortDirection;
};

export function usePromptsSourceData({
  apiBaseURL,
  organizationId,
  monitoringData,
  projectId,
  deferredSearch,
  promptSort,
  promptSortDirection,
}: UsePromptsSourceDataParams) {
  const activeProjectId = projectId || monitoringData.project.id || "";
  const projectModels = monitoringData.models;
  const liveModels = useMemo(
    () => projectModels.filter((item) => item.live),
    [projectModels],
  );
  const modelMeta = useMemo(
    () =>
      new Map(
        Array.from(buildProjectModelLookup(projectModels).entries()).map(
          ([key, model]) => [key, toProjectModelVisual(model) as ModelVisual] as const,
        ),
      ),
    [projectModels],
  );
  const modelLookup = useMemo(() => buildProjectModelLookup(projectModels), [projectModels]);

  const getModelVisual = (model: string): ModelVisual => {
    const normalizedModel = normalizeModelName(model);
    const exactVisual = modelMeta.get(normalizedModel);
    if (exactVisual) return exactVisual;

    const partialMatch = Array.from(modelLookup.values()).find((candidate) => {
      const keys = [
        candidate.id,
        candidate.displayName,
        candidate.groupName,
        candidate.providerModelId,
      ].map((value) => normalizeModelName(value));

      return keys.some(
        (key) =>
          key !== "" &&
          (key.includes(normalizedModel) || normalizedModel.includes(key)),
      );
    });

    if (partialMatch) {
      return toProjectModelVisual(partialMatch);
    }

    const providerVisual = findProviderVisual(model);
    const provider = providerVisual?.provider ?? "AI provider";
    const name = getProviderModelName(model) || model || "Modele IA";

    return {
      icon: providerVisual?.icon ?? "/models/openai.svg",
      description: model || "Modele IA",
      label: name,
      provider: providerVisual?.provider ?? buildProviderLabel(provider),
      name,
    };
  };

  const responseAvailableModels = useMemo(
    () =>
      dedupeModels([
        ...liveModels.map((item) => item.id),
        ...monitoringData.recent_prompts.map(
          (item) =>
            item.modelId ||
            item.modelProviderModelId ||
            item.modelDisplayName ||
            item.modelGroupName,
        ),
      ].filter((item): item is string => typeof item === "string" && item.trim() !== "")),
    [liveModels, monitoringData.recent_prompts],
  );
  const promptAvailableModels = useMemo(
    () => dedupeModels(liveModels.map((item) => item.id)),
    [liveModels],
  );
  const activeModelKeys = useMemo(
    () => new Set(buildProjectModelLookup(liveModels).keys()),
    [liveModels],
  );
  const availablePersonas = useMemo(
    () =>
      Array.from(
        new Set(
          monitoringData.recent_prompts
            .map((item) => item.persona?.trim() || "")
            .filter(Boolean),
        ),
      ),
    [monitoringData.recent_prompts],
  );
  const availableCompetitors = useMemo(
    () => monitoringData.project.competitors.map((item) => item.name),
    [monitoringData.project.competitors],
  );

  const promptsCatalogQuery = useQuery<ProjectPromptRecord[]>({
    queryKey: appQueryKeys.promptsCatalog(
      apiBaseURL,
      organizationId,
      activeProjectId,
      deferredSearch,
      promptSort,
      promptSortDirection,
    ),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "" && activeProjectId !== "",
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) =>
      loadAllPromptPages(
        apiBaseURL,
        organizationId,
        activeProjectId,
        deferredSearch,
        signal,
      ),
  });

  const serverPromptItems = useMemo(
    () =>
      buildPromptPageItems({
        projectPrompts: (promptsCatalogQuery.data ?? []).filter(
          (prompt) => prompt.kind === "monitoring",
        ),
        recentPrompts: monitoringData.recent_prompts.filter((item) =>
          activeModelKeys.has(normalizeModelName(item.modelId || item.modelProviderModelId || "")),
        ) as never,
        competitors: monitoringData.project.competitors,
        availableModels: promptAvailableModels,
        stages: STAGES,
      }),
    [
      activeModelKeys,
      monitoringData.project.competitors,
      monitoringData.recent_prompts,
      promptAvailableModels,
      promptsCatalogQuery.data,
    ],
  );
  const persistedPromptIds = useMemo(
    () => new Set((promptsCatalogQuery.data ?? []).map((item) => item.id)),
    [promptsCatalogQuery.data],
  );

  return {
    activeProjectId,
    projectModels,
    liveModels,
    promptAvailableModels,
    responseAvailableModels,
    activeModelKeys,
    availablePersonas,
    availableCompetitors,
    getModelVisual,
    promptsCatalogQuery,
    serverPromptItems,
    persistedPromptIds,
  };
}
