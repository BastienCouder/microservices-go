"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  findAIProviderAsset,
  getAIProviderIconPath,
} from "@/lib/ai-provider-assets";
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
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type {
  ModelVisual,
  ProjectPromptRecord,
  PromptSort,
  PromptSortDirection,
} from "./types";

function getProviderModelName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const pathParts = trimmed.split("/").filter(Boolean);
  const lastPathPart = pathParts.at(-1) ?? trimmed;

  return lastPathPart.trim();
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
  const { t } = useScopedI18n("shared-ui");
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

    const providerVisual = findAIProviderAsset(model);
    const provider = providerVisual?.provider ?? t("aiProvider");
    const name = getProviderModelName(model) || model || t("aiModel");

    return {
      icon: getAIProviderIconPath(model),
      description: model || t("aiModel"),
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
    () =>
      new Set(
        (promptsCatalogQuery.data ?? [])
          .filter((item) => item.kind === "monitoring")
          .map((item) => item.id),
      ),
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
