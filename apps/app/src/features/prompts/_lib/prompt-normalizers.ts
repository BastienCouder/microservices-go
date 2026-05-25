"use client";

import { SELECTED_ORG_KEY } from "@/features/models/_lib/model-access";
import {
  comparePromptRunsByRecency,
  DEFAULT_PROMPT_CRON,
  DEFAULT_PROMPT_TIMEZONE,
  defaultPromptSchedule,
  normalizeModelName,
  promptScheduleLabel,
} from "./utils";
import { buildTrend30dFromRuns } from "./prompt-data-factory";
import type {
  PromptItem,
  PromptKind,
  PromptPageResult,
  PromptRowMode,
  PromptSchedule,
  PromptSort,
  PromptSortDirection,
  ProjectPromptRecord,
} from "./types";

export const PROMPTS_PAGE_SIZE = 25;
export const PROMPTS_CATALOG_PAGE_SIZE = 100;
export const RESPONSES_BATCH_SIZE = 40;

export const PROMPT_SORT_DEFAULT_DIRECTION: Record<PromptSort, PromptSortDirection> = {
  prompt: "asc",
  persona: "asc",
  ai: "asc",
  mention: "desc",
  rank: "asc",
  sov: "desc",
  lastRun: "asc",
  status: "asc",
};

const PROMPT_STATUS_ORDER: Record<PromptItem["status"], number> = {
  active: 0,
  disabled: 1,
  archived: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getField<T = unknown>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in obj) return obj[key] as T;
  }
  return undefined;
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) {
    return value.data;
  }
  return value;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getBool(value: unknown): boolean {
  return value === true;
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizePromptStatus(value: unknown): PromptItem["status"] | undefined {
  const raw = getString(value).toLowerCase();
  if (raw === "active" || raw === "disabled" || raw === "archived") {
    return raw;
  }
  return undefined;
}

function normalizePromptKind(value: unknown): PromptKind {
  return getString(value).toLowerCase() === "perception" ? "perception" : "monitoring";
}

export function dedupeModels(models: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const model of models) {
    const value = model.trim();
    if (!value) continue;
    const key = normalizeModelName(value);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }

  return unique;
}

export function normalizePromptScheduleValue(input: unknown): PromptSchedule {
  if (!isRecord(input)) return defaultPromptSchedule();
  const mode = getString(getField(input, ["mode", "Mode"])) === "per_model" ? "per_model" : "global";
  const cron = getString(getField(input, ["cron", "Cron"])) || DEFAULT_PROMPT_CRON;
  const timezone = getString(getField(input, ["timezone", "Timezone"])) || DEFAULT_PROMPT_TIMEZONE;
  const rawOverrides = getField<Record<string, unknown>>(input, ["modelCrons", "ModelCrons"]);
  const modelCrons = Object.fromEntries(
    Object.entries(rawOverrides ?? {})
      .map(([modelId, cronValue]) => [modelId.trim(), getString(cronValue)])
      .filter(([modelId, cronValue]) => modelId !== "" && cronValue !== ""),
  );

  return { mode, cron, timezone, modelCrons };
}

export function buildScopedPromptMetrics(item: PromptItem, models: string[]): PromptItem {
  const scopedModels = dedupeModels(models);
  const normalizedScopedModels = new Set(scopedModels.map((model) => normalizeModelName(model)));
  const scopedRuns =
    normalizedScopedModels.size === 0
      ? item.runs
      : item.runs.filter((run) => normalizedScopedModels.has(normalizeModelName(run.model)));

  const mentionRate =
    scopedRuns.length > 0
      ? Math.round((scopedRuns.filter((run) => run.mention).length / scopedRuns.length) * 100)
      : 0;
  const rankedRuns = scopedRuns.filter((run) => typeof run.rank === "number");
  const rank =
    rankedRuns.length > 0
      ? Number((rankedRuns.reduce((sum, run) => sum + (run.rank ?? 0), 0) / rankedRuns.length).toFixed(1))
      : null;
  const sov =
    scopedRuns.length > 0
      ? Math.round(scopedRuns.reduce((sum, run) => sum + run.score, 0) / scopedRuns.length)
      : 0;
  const lastRunMinutes =
    scopedRuns.length > 0 ? Math.min(...scopedRuns.map((run) => run.minutesAgo)) : 999999;
  const trend30d = buildTrend30dFromRuns(scopedRuns);

  return {
    ...item,
    models: scopedModels,
    runs: scopedRuns,
    mentionRate,
    rank,
    sov,
    lastRunMinutes,
    trend30d,
  };
}

export function getPromptSelectionKey(item: PromptItem, rowMode: PromptRowMode) {
  return rowMode === "model" ? item.id : item.sourcePromptId || item.id;
}

export function readSelectedOrganizationId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SELECTED_ORG_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function normalizeProjectPromptRecord(entry: Record<string, unknown>): ProjectPromptRecord {
  return {
    id: getString(getField(entry, ["id", "ID"])),
    text: getString(getField(entry, ["text", "Text"])),
    intent: getString(getField(entry, ["intent", "Intent"])) || undefined,
    kind: normalizePromptKind(getField(entry, ["kind", "Kind"])),
    type:
      getString(
        getField(entry, ["type", "Type", "responseFormat", "response_format", "ResponseFormat"]),
      ) || undefined,
    modelIds: dedupeModels(
      (getField(entry, ["modelIds", "ModelIds"]) as unknown[] | undefined)?.filter(
        (item): item is string => typeof item === "string",
      ) ?? [],
    ),
    schedule: normalizePromptScheduleValue(getField(entry, ["schedule", "Schedule"])),
    status: normalizePromptStatus(getField(entry, ["status", "Status"])),
    isActive: getBool(getField(entry, ["isActive", "IsActive"])),
    createdAt: getString(getField(entry, ["createdAt", "CreatedAt"])) || undefined,
    updatedAt: getString(getField(entry, ["updatedAt", "UpdatedAt"])) || undefined,
  };
}

export function normalizePromptPage(value: unknown): PromptPageResult {
  const payload = unwrapSuccessEnvelope(value);
  const record = isRecord(payload) ? payload : {};
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(record.items)
      ? record.items
      : [];
  const items = rawItems
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map(normalizeProjectPromptRecord)
    .filter((item) => item.id !== "" && item.text !== "");
  const isLegacyArray = Array.isArray(payload);
  const total = isLegacyArray ? items.length : getNumber(getField(record, ["total", "Total"]));
  const page = isLegacyArray ? 1 : Math.max(1, getNumber(getField(record, ["page", "Page"])) || 1);
  const pageSize = isLegacyArray
    ? Math.max(items.length, PROMPTS_PAGE_SIZE)
    : Math.max(1, getNumber(getField(record, ["pageSize", "PageSize"])) || PROMPTS_PAGE_SIZE);
  const totalPages = isLegacyArray
    ? (items.length > 0 ? 1 : 0)
    : Math.max(0, getNumber(getField(record, ["totalPages", "TotalPages"])));
  const hasNext = isLegacyArray ? false : getBool(getField(record, ["hasNext", "HasNext"]));
  const hasPrevious = isLegacyArray ? false : getBool(getField(record, ["hasPrevious", "HasPrevious"]));

  return { items, total, page, pageSize, totalPages, hasNext, hasPrevious };
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, "fr", { sensitivity: "base", numeric: true });
}

function comparePromptItems(a: PromptItem, b: PromptItem, field: PromptSort): number {
  if (field === "prompt") return compareStrings(a.prompt, b.prompt);
  if (field === "persona") {
    return compareStrings(a.persona?.trim() || "\uffff", b.persona?.trim() || "\uffff");
  }
  if (field === "ai") {
    const aModels = a.models.map((model) => normalizeModelName(model)).join("|");
    const bModels = b.models.map((model) => normalizeModelName(model)).join("|");
    return compareStrings(aModels || "\uffff", bModels || "\uffff");
  }
  if (field === "mention") return a.mentionRate - b.mentionRate;
  if (field === "rank") {
    if (a.rank === null && b.rank === null) return 0;
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  }
  if (field === "sov") return a.sov - b.sov;
  if (field === "lastRun") return a.lastRunMinutes - b.lastRunMinutes;
  if (field === "status") {
    return PROMPT_STATUS_ORDER[a.status] - PROMPT_STATUS_ORDER[b.status];
  }
  return compareStrings(a.prompt, b.prompt);
}

export function sortPromptItems(
  rows: PromptItem[],
  field: PromptSort,
  direction: PromptSortDirection,
): PromptItem[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary = comparePromptItems(a, b, field);
    if (primary !== 0) return primary * multiplier;
    return compareStrings(a.prompt, b.prompt);
  });
}

export function buildModelScopedPromptRows(prompts: PromptItem[]): PromptItem[] {
  return prompts.flatMap((prompt) => {
    const sourcePromptId = prompt.sourcePromptId || prompt.id;
    const runsByModel = prompt.runs.reduce((map, run) => {
      const bucket = map.get(run.model) ?? [];
      bucket.push(run);
      map.set(run.model, bucket);
      return map;
    }, new Map<string, typeof prompt.runs>());

    const models =
      prompt.models.length > 0
        ? prompt.models
        : runsByModel.size > 0
          ? Array.from(runsByModel.keys())
          : [];

    return models.map((model, index) => {
      const runs = [...(runsByModel.get(model) ?? [])].sort(comparePromptRunsByRecency);
      const overrideCron = prompt.schedule.modelCrons[model];
      const nextPrompt = buildScopedPromptMetrics(prompt, [model]);
      return {
        ...nextPrompt,
        id: `${sourcePromptId}::${normalizeModelName(model) || index}`,
        sourcePromptId,
        rowMode: "model" as PromptRowMode,
        models: model ? [model] : [],
        effectiveCron: overrideCron || prompt.schedule.cron,
        effectiveScheduleLabel: promptScheduleLabel(prompt.schedule, overrideCron),
        effectiveScheduleSource: overrideCron ? "override" : "global",
        runs,
      };
    });
  });
}
