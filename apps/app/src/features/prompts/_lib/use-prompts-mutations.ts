"use client";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { gatewayJSON } from "@/shared/api/gateway";
import { createProjectPrompt, deleteProjectPrompt, patchPrompt, patchPromptModels, patchPromptSchedule } from "./prompt-api";
import {
  addSeedPrompts,
  applyBulkPromptStatus,
  canRunPersistedPrompt,
  deletePromptLocally,
  updatePromptModelsLocally,
  updatePromptScheduleLocally,
} from "./prompt-mutation-actions";
import { dedupeModels, normalizePromptScheduleValue } from "./prompt-normalizers";
import { startPromptAnalyses } from "./prompt-run";
import { promptScheduleLabel } from "./utils";
import type {
  AIModel,
  PromptItem,
  PromptSchedule,
  PromptSort,
  PromptSortDirection,
  SavePromptEditorInput,
} from "./types";

type UsePromptsMutationsParams = {
  apiBaseURL: string;
  queryClient: QueryClient;
  mode: string;
  organizationId: string;
  activeProjectId: string;
  quotaReached: boolean;
  deferredSearch: string;
  promptSort: PromptSort;
  promptSortDirection: PromptSortDirection;
  promptAvailableModels: AIModel[];
  availablePersonas: string[];
  manualPrompts: PromptItem[];
  persistedPromptIds: Set<string>;
  setManualPrompts: Dispatch<SetStateAction<PromptItem[]>>;
  setPromptPage: Dispatch<SetStateAction<number>>;
  setPromptEditorState: Dispatch<SetStateAction<{ mode: "create" | "edit"; promptId?: string } | null>>;
  setEditingPromptModelsId: Dispatch<SetStateAction<string | null>>;
  setEditingPromptScheduleId: Dispatch<SetStateAction<string | null>>;
  setHiddenPromptIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPromptIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPromptId: Dispatch<SetStateAction<string | null>>;
  setRunningPromptRowIds: Dispatch<SetStateAction<string[]>>;
};

export function usePromptsMutations(params: UsePromptsMutationsParams) {
  const invalidateCatalog = async () => {
    if (!params.organizationId || !params.activeProjectId) return;
    await params.queryClient.invalidateQueries({
      queryKey: appQueryKeys.promptsCatalog(params.apiBaseURL, params.organizationId, params.activeProjectId, params.deferredSearch, params.promptSort, params.promptSortDirection),
    });
  };

  const bulkPromptStatusMutation = useMutation({
    mutationFn: async ({
      promptIds,
      status,
    }: {
      promptIds: string[];
      status: PromptItem["status"];
    }) => {
      const response = await gatewayJSON<unknown>(
        params.apiBaseURL,
        apiRoutes.projects.promptsStatus(params.activeProjectId),
        {
          method: "PATCH",
          organizationId: params.organizationId,
          body: JSON.stringify({ promptIds, status }),
        },
      );

      if (!response.ok) {
        throw new Error("Impossible de mettre a jour le statut des prompts.");
      }

      return { promptIds, status };
    },
    onSuccess: invalidateCatalog,
  });

  const updatePromptModelsMutation = useMutation({
    mutationFn: async ({ promptId, modelIds }: { promptId: string; modelIds: AIModel[] }) => {
      await patchPromptModels(params.apiBaseURL, params.organizationId, promptId, modelIds);
    },
    onSuccess: async () => {
      await invalidateCatalog();
      params.setEditingPromptModelsId(null);
    },
  });

  const updatePromptScheduleMutation = useMutation({
    mutationFn: async ({ promptId, schedule }: { promptId: string; schedule: PromptSchedule }) => {
      await patchPromptSchedule(params.apiBaseURL, params.organizationId, promptId, schedule);
    },
    onSuccess: async () => {
      await invalidateCatalog();
      params.setEditingPromptScheduleId(null);
    },
  });

  const savePromptEditorMutation = useMutation({
    mutationFn: async ({
      mode: nextMode,
      promptId,
      text,
      modelIds,
      schedule,
      status,
    }: SavePromptEditorInput) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        throw new Error("Le prompt ne peut pas etre vide.");
      }

      const resolvedModels = dedupeModels(modelIds).filter((model) =>
        params.promptAvailableModels.includes(model),
      );
      const nextModels =
        resolvedModels.length > 0
          ? resolvedModels
          : params.promptAvailableModels.slice(0, 1);
      const nextSchedule = normalizePromptScheduleValue(schedule);
      const manualPromptIds = new Set(
        params.manualPrompts.map((item) => item.sourcePromptId || item.id),
      );

      if (nextMode === "create") {
        if (params.mode === "demo" || !params.organizationId || !params.activeProjectId) {
          const nextId = `p${Date.now()}`;
          const newPrompt: PromptItem = {
            id: nextId,
            sourcePromptId: nextId,
            rowMode: "global",
            prompt: trimmedText,
            stage: "Awareness",
            models: nextModels,
            schedule: nextSchedule,
            effectiveCron: nextSchedule.cron,
            effectiveScheduleLabel: promptScheduleLabel(nextSchedule),
            effectiveScheduleSource: "global",
            mentionRate: 0,
            rank: 9.9,
            sov: 0,
            lastRunMinutes: 1,
            trend30d: [0, 0, 0, 0, 0, 0, 0],
            status,
            runs: [],
          };
          params.setManualPrompts((current) => [newPrompt, ...current]);
          return;
        }

        const createdPrompt = await createProjectPrompt(
          params.apiBaseURL,
          params.organizationId,
          params.activeProjectId,
          trimmedText,
        );
        await patchPrompt(params.apiBaseURL, params.organizationId, createdPrompt.id, {
          modelIds: nextModels,
          schedule: nextSchedule,
          status,
        });
        return;
      }

      if (!promptId) {
        throw new Error("Prompt introuvable.");
      }

      if (manualPromptIds.has(promptId)) {
        params.setManualPrompts((current) =>
          current.map((item) =>
            (item.sourcePromptId || item.id) === promptId
              ? {
                  ...item,
                  prompt: trimmedText,
                  models: nextModels,
                  schedule: nextSchedule,
                  effectiveCron: nextSchedule.cron,
                  effectiveScheduleLabel: promptScheduleLabel(nextSchedule),
                  effectiveScheduleSource: "global",
                  status,
                }
              : item,
          ),
        );
        return;
      }

      if (!params.organizationId || !params.activeProjectId) {
        throw new Error("Impossible d'enregistrer le prompt.");
      }

      await patchPrompt(params.apiBaseURL, params.organizationId, promptId, {
        text: trimmedText,
        modelIds: nextModels,
        schedule: nextSchedule,
        status,
      });
    },
    onSuccess: async () => {
      params.setPromptPage(1);
      params.setPromptEditorState(null);
      await invalidateCatalog();
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      await deleteProjectPrompt(params.apiBaseURL, params.organizationId, promptId);
      return promptId;
    },
    onSuccess: invalidateCatalog,
    onError: (_error, promptId) => {
      params.setHiddenPromptIds((current) => current.filter((item) => item !== promptId));
    },
  });

  const runPromptsMutation = useMutation({
    mutationFn: async (promptsToRun: PromptItem[]) => {
      await startPromptAnalyses({
        apiBaseURL: params.apiBaseURL,
        organizationId: params.organizationId,
        projectId: params.activeProjectId,
        prompts: promptsToRun.map((prompt) => ({
          id: prompt.id,
          sourcePromptId: prompt.sourcePromptId || prompt.id,
          prompt: prompt.prompt,
          models: prompt.models,
        })),
      });
      return promptsToRun.map((prompt) => prompt.id);
    },
    onMutate: (promptsToRun) => {
      params.setRunningPromptRowIds(promptsToRun.map((prompt) => prompt.id));
    },
    onSuccess: async () => {
      await params.queryClient.invalidateQueries({
        queryKey: ["monitoring", params.apiBaseURL, params.activeProjectId],
      });
    },
    onSettled: async () => {
      await params.queryClient.invalidateQueries({
        queryKey: appQueryKeys.promptQuota(
          params.apiBaseURL,
          params.organizationId,
          params.activeProjectId,
        ),
      });
      params.setRunningPromptRowIds([]);
    },
  });

  const { addAutoGeneratedPrompts, addImportedPrompts } = addSeedPrompts({
    promptAvailableModels: params.promptAvailableModels,
    availablePersonas: params.availablePersonas,
    setManualPrompts: params.setManualPrompts,
    setPromptPage: params.setPromptPage,
  });

  const canRunPrompt = (prompt?: Pick<PromptItem, "id" | "sourcePromptId"> | null) =>
    !params.quotaReached &&
    canRunPersistedPrompt(prompt, {
      organizationId: params.organizationId,
      activeProjectId: params.activeProjectId,
      persistedPromptIds: params.persistedPromptIds,
    });

  const applyBulkStatus = (
    status: PromptItem["status"],
    promptRowMode: "global" | "model",
    selectedPromptIds: string[],
    filteredPromptRows: PromptItem[],
  ) =>
    applyBulkPromptStatus({
      promptRowMode,
      selectedPromptIds,
      filteredPromptRows,
      manualPrompts: params.manualPrompts,
      organizationId: params.organizationId,
      activeProjectId: params.activeProjectId,
      setManualPrompts: params.setManualPrompts,
      mutateRemote: bulkPromptStatusMutation.mutate,
    })(status);

  const deletePrompt = (id: string, selectedPromptId: string | null) =>
    deletePromptLocally({
      id,
      selectedPromptId,
      organizationId: params.organizationId,
      activeProjectId: params.activeProjectId,
      setManualPrompts: params.setManualPrompts,
      setSelectedPromptIds: params.setSelectedPromptIds,
      setSelectedPromptId: params.setSelectedPromptId,
      setHiddenPromptIds: params.setHiddenPromptIds,
      mutateRemote: deletePromptMutation.mutate,
    });

  const updatePromptModels = (promptId: string, modelIds: AIModel[]) =>
    updatePromptModelsLocally({
      promptId,
      modelIds,
      promptAvailableModels: params.promptAvailableModels,
      manualPrompts: params.manualPrompts,
      organizationId: params.organizationId,
      activeProjectId: params.activeProjectId,
      setManualPrompts: params.setManualPrompts,
      setEditingPromptModelsId: params.setEditingPromptModelsId,
      mutateRemote: updatePromptModelsMutation.mutate,
    });

  const updatePromptSchedule = (promptId: string, schedule: PromptSchedule) =>
    updatePromptScheduleLocally({
      promptId,
      schedule,
      manualPrompts: params.manualPrompts,
      organizationId: params.organizationId,
      activeProjectId: params.activeProjectId,
      setManualPrompts: params.setManualPrompts,
      setEditingPromptScheduleId: params.setEditingPromptScheduleId,
      mutateRemote: updatePromptScheduleMutation.mutate,
    });

  return {
    bulkPromptStatusMutation,
    savePromptEditorMutation,
    deletePromptMutation,
    updatePromptModelsMutation,
    updatePromptScheduleMutation,
    runPromptsMutation,
    addAutoGeneratedPrompts,
    addImportedPrompts,
    applyBulkStatus,
    deletePrompt,
    canRunPrompt,
    updatePromptModels,
    updatePromptSchedule,
  };
}
