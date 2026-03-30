"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
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

  const getModelVisual = (model: string): ModelVisual =>
    modelMeta.get(normalizeModelName(model)) || {
      icon: "/models/openai.svg",
      description: "Modele IA",
      label: model,
      provider: "OpenAI",
      name: model,
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
        projectPrompts: promptsCatalogQuery.data ?? [],
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
