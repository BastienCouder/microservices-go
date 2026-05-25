import type { Dispatch, SetStateAction } from "react";
import {
  buildImportedPrompts,
} from "./prompt-seed-factory";
import { dedupeModels } from "./prompt-normalizers";
import { promptScheduleLabel } from "./utils";
import type { AIModel, PromptItem, PromptRowMode, PromptSchedule } from "./types";

export function addSeedPrompts(params: {
  setManualPrompts: Dispatch<SetStateAction<PromptItem[]>>;
  setPromptPage: Dispatch<SetStateAction<number>>;
}) {
  return {
    addImportedPrompts: () => {
      const imported = buildImportedPrompts();
      params.setManualPrompts((current) => [...imported, ...current]);
      params.setPromptPage(1);
    },
  };
}

export function applyBulkPromptStatus(params: {
  promptRowMode: "global" | "model";
  selectedPromptIds: string[];
  filteredPromptRows: PromptItem[];
  manualPrompts: PromptItem[];
  organizationId: string;
  activeProjectId: string;
  setManualPrompts: Dispatch<SetStateAction<PromptItem[]>>;
  mutateRemote: (input: { promptIds: string[]; status: PromptItem["status"] }) => void;
}) {
  return (status: PromptItem["status"]) => {
    if (params.promptRowMode === "model" || params.selectedPromptIds.length === 0) return;
    const targetPromptIds = resolveBulkPromptIds({
      promptRowMode: params.promptRowMode,
      selectedPromptIds: params.selectedPromptIds,
      filteredPromptRows: params.filteredPromptRows,
    });
    if (targetPromptIds.length === 0) return;
    const manualPromptIds = new Set(params.manualPrompts.map((item) => item.sourcePromptId || item.id));
    const localPromptIds = targetPromptIds.filter((id) => manualPromptIds.has(id));
    const serverPromptIds = targetPromptIds.filter((id) => !manualPromptIds.has(id));

    if (localPromptIds.length > 0) {
      params.setManualPrompts((current) =>
        current.map((item) =>
          localPromptIds.includes(item.sourcePromptId || item.id) ? { ...item, status } : item,
        ),
      );
    }

    if (serverPromptIds.length > 0 && params.organizationId && params.activeProjectId) {
      params.mutateRemote({ promptIds: serverPromptIds, status });
    }
  };
}

export function resolveBulkPromptIds(params: {
  promptRowMode: PromptRowMode;
  selectedPromptIds: string[];
  filteredPromptRows: Pick<PromptItem, "id" | "sourcePromptId">[];
}) {
  if (params.selectedPromptIds.length === 0) return [];

  return Array.from(
    new Set(
      params.filteredPromptRows
        .filter((item) =>
          params.selectedPromptIds.includes(
            params.promptRowMode === "model" ? item.id : item.sourcePromptId || item.id,
          ),
        )
        .map((item) => item.sourcePromptId || item.id),
    ),
  );
}

export function deletePromptLocally(params: {
  id: string;
  selectedPromptId: string | null;
  organizationId: string;
  activeProjectId: string;
  setManualPrompts: Dispatch<SetStateAction<PromptItem[]>>;
  setSelectedPromptIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPromptId: Dispatch<SetStateAction<string | null>>;
  setHiddenPromptIds: Dispatch<SetStateAction<string[]>>;
  mutateRemote: (promptId: string) => void;
}) {
  let removedManual = false;
  params.setManualPrompts((current) => {
    const next = current.filter((item) => (item.sourcePromptId || item.id) !== params.id);
    removedManual = next.length !== current.length;
    return next;
  });
  params.setSelectedPromptIds((current) => current.filter((item) => item !== params.id));
  if (params.selectedPromptId === params.id) params.setSelectedPromptId(null);

  if (removedManual) return;
  if (!params.organizationId || !params.activeProjectId) {
    params.setHiddenPromptIds((current) => (current.includes(params.id) ? current : [...current, params.id]));
    return;
  }

  params.setHiddenPromptIds((current) => (current.includes(params.id) ? current : [...current, params.id]));
  params.mutateRemote(params.id);
}

export function deletePromptsLocally(params: {
  promptIds: string[];
  organizationId: string;
  activeProjectId: string;
  manualPrompts: PromptItem[];
  setManualPrompts: Dispatch<SetStateAction<PromptItem[]>>;
  setSelectedPromptIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPromptId: Dispatch<SetStateAction<string | null>>;
  setHiddenPromptIds: Dispatch<SetStateAction<string[]>>;
  mutateRemote: (promptId: string) => void;
}) {
  const promptIds = Array.from(new Set(params.promptIds.map((id) => id.trim()).filter(Boolean)));
  if (promptIds.length === 0) return;

  const targetPromptIDs = new Set(promptIds);
  const manualPromptIds = new Set(
    params.manualPrompts.map((item) => item.sourcePromptId || item.id),
  );
  const serverPromptIds = promptIds.filter((id) => !manualPromptIds.has(id));

  params.setManualPrompts((current) =>
    current.filter((item) => !targetPromptIDs.has(item.sourcePromptId || item.id)),
  );
  params.setSelectedPromptIds((current) =>
    current.filter(
      (item) =>
        !promptIds.some((promptId) => item === promptId || item.startsWith(`${promptId}::`)),
    ),
  );
  params.setSelectedPromptId((current) => {
    if (!current) return null;
    return promptIds.some((promptId) => current === promptId || current.startsWith(`${promptId}::`))
      ? null
      : current;
  });

  if (serverPromptIds.length === 0) return;

  params.setHiddenPromptIds((current) => {
    const next = [...current];
    for (const promptId of serverPromptIds) {
      if (!next.includes(promptId)) next.push(promptId);
    }
    return next;
  });

  if (!params.organizationId || !params.activeProjectId) {
    return;
  }

  for (const promptId of serverPromptIds) {
    params.mutateRemote(promptId);
  }
}

export function canRunPersistedPrompt(prompt: Pick<PromptItem, "id" | "sourcePromptId"> | null | undefined, params: {
  organizationId: string;
  activeProjectId: string;
  persistedPromptIds: Set<string>;
}) {
  return Boolean(
    prompt &&
      params.organizationId &&
      params.activeProjectId &&
      params.persistedPromptIds.has(prompt.sourcePromptId || prompt.id),
  );
}

export function updatePromptModelsLocally(params: {
  promptId: string;
  modelIds: AIModel[];
  promptAvailableModels: AIModel[];
  manualPrompts: PromptItem[];
  organizationId: string;
  activeProjectId: string;
  setManualPrompts: Dispatch<SetStateAction<PromptItem[]>>;
  setEditingPromptModelsId: Dispatch<SetStateAction<string | null>>;
  mutateRemote: (input: { promptId: string; modelIds: AIModel[] }) => void;
}) {
  const nextModels = dedupeModels(params.modelIds).filter((model) =>
    params.promptAvailableModels.includes(model),
  );
  const resolvedModels =
    nextModels.length > 0 ? nextModels : params.promptAvailableModels.slice(0, 1);
  const manualPromptIds = new Set(params.manualPrompts.map((item) => item.sourcePromptId || item.id));

  if (manualPromptIds.has(params.promptId)) {
    params.setManualPrompts((current) =>
      current.map((item) =>
        (item.sourcePromptId || item.id) === params.promptId ? { ...item, models: resolvedModels } : item,
      ),
    );
    params.setEditingPromptModelsId(null);
    return;
  }

  if (!params.organizationId || !params.activeProjectId) return;
  params.mutateRemote({ promptId: params.promptId, modelIds: resolvedModels });
}

export function updatePromptScheduleLocally(params: {
  promptId: string;
  schedule: PromptSchedule;
  manualPrompts: PromptItem[];
  organizationId: string;
  activeProjectId: string;
  setManualPrompts: Dispatch<SetStateAction<PromptItem[]>>;
  setEditingPromptScheduleId: Dispatch<SetStateAction<string | null>>;
  mutateRemote: (input: { promptId: string; schedule: PromptSchedule }) => void;
}) {
  const manualPromptIds = new Set(params.manualPrompts.map((item) => item.sourcePromptId || item.id));

  if (manualPromptIds.has(params.promptId)) {
    params.setManualPrompts((current) =>
      current.map((item) =>
        (item.sourcePromptId || item.id) === params.promptId
          ? {
              ...item,
              schedule: params.schedule,
              effectiveCron: params.schedule.cron,
              effectiveScheduleLabel: promptScheduleLabel(params.schedule),
              effectiveScheduleSource: "global",
            }
          : item,
      ),
    );
    params.setEditingPromptScheduleId(null);
    return;
  }

  if (!params.organizationId || !params.activeProjectId) return;
  params.mutateRemote({ promptId: params.promptId, schedule: params.schedule });
}
