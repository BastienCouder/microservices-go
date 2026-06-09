import type { QueryKey } from "@tanstack/react-query";
import { normalizeModelName } from "./utils";

type PromptRunProgressPrompt = {
  id: string;
  sourcePromptId: string;
  models: string[];
};

type MonitoringPromptProgressItem = {
  promptId?: string;
  modelId?: string;
  modelProviderModelId?: string;
  modelDisplayName?: string;
  modelGroupName?: string;
  createdAt?: string;
};

type PromptRunProgressSnapshot = {
  count: number;
  latestCreatedAt: string | null;
};

export type PromptRunProgressEntry = {
  rowId: string;
  sourcePromptId: string;
  models: string[];
  startedAt: string;
  expiresAt: string;
  baseline: Record<string, PromptRunProgressSnapshot>;
};

const PROMPT_RUN_PROGRESS_TIMEOUT_MS = 2 * 60 * 1000;

function resolveMonitoringModelKey(item: MonitoringPromptProgressItem): string {
  return normalizeModelName(
    item.modelId ||
      item.modelProviderModelId ||
      item.modelDisplayName ||
      item.modelGroupName ||
      "",
  );
}

function buildProgressSnapshots(
  recentPrompts: MonitoringPromptProgressItem[],
  promptId: string,
): Record<string, PromptRunProgressSnapshot> {
  const snapshots = new Map<string, PromptRunProgressSnapshot>();

  for (const item of recentPrompts) {
    if ((item.promptId || "").trim() !== promptId.trim()) continue;

    const modelKey = resolveMonitoringModelKey(item);
    if (!modelKey) continue;

    const current = snapshots.get(modelKey) ?? { count: 0, latestCreatedAt: null };
    const createdAt = item.createdAt?.trim() || null;
    snapshots.set(modelKey, {
      count: current.count + 1,
      latestCreatedAt:
        createdAt && (!current.latestCreatedAt || createdAt > current.latestCreatedAt)
          ? createdAt
          : current.latestCreatedAt,
    });
  }

  return Object.fromEntries(snapshots.entries());
}

function getSnapshot(
  snapshots: Record<string, PromptRunProgressSnapshot>,
  modelKey: string,
): PromptRunProgressSnapshot {
  return snapshots[modelKey] ?? { count: 0, latestCreatedAt: null };
}

export function createPromptRunProgressEntries(
  prompts: PromptRunProgressPrompt[],
  recentPrompts: MonitoringPromptProgressItem[],
  now = new Date(),
): PromptRunProgressEntry[] {
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + PROMPT_RUN_PROGRESS_TIMEOUT_MS).toISOString();

  return prompts.map((prompt) => {
    const sourcePromptId = (prompt.sourcePromptId || prompt.id).trim();
    const promptSnapshots = buildProgressSnapshots(recentPrompts, sourcePromptId);

    return {
      rowId: prompt.id,
      sourcePromptId,
      models: prompt.models,
      startedAt,
      expiresAt,
      baseline: prompt.models.reduce<Record<string, PromptRunProgressSnapshot>>((acc, model) => {
        const modelKey = normalizeModelName(model);
        if (!modelKey) return acc;
        acc[modelKey] = getSnapshot(promptSnapshots, modelKey);
        return acc;
      }, {}),
    };
  });
}

export function isPromptRunProgressComplete(
  entry: PromptRunProgressEntry,
  recentPrompts: MonitoringPromptProgressItem[],
): boolean {
  const currentSnapshots = buildProgressSnapshots(recentPrompts, entry.sourcePromptId);

  return entry.models.every((model) => {
    const modelKey = normalizeModelName(model);
    if (!modelKey) return true;

    const baseline = getSnapshot(entry.baseline, modelKey);
    const current = getSnapshot(currentSnapshots, modelKey);

    if (current.count > baseline.count) return true;
    if (current.latestCreatedAt && current.latestCreatedAt > entry.startedAt) return true;

    return false;
  });
}

export function isPromptRunProgressExpired(
  entry: PromptRunProgressEntry,
  now = new Date(),
): boolean {
  return now.toISOString() >= entry.expiresAt;
}

export function isMonitoringQueryForProject(
  queryKey: QueryKey,
  apiBaseURL: string,
  projectId: string,
): boolean {
  return (
    Array.isArray(queryKey) &&
    queryKey[0] === "monitoring" &&
    queryKey[1] === apiBaseURL &&
    queryKey[2] === projectId
  );
}
