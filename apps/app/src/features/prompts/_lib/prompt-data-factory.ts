import type { PromptItem, PromptRunRow, PromptSchedule, Stage } from "./types";
import {
  comparePromptRunsByRecency,
  defaultPromptSchedule,
  normalizeModelName,
  parseRelativeTimeToMinutes,
  promptScheduleLabel,
} from "./utils";

type MonitoringPromptInput = {
  responseId: string;
  promptId: string;
  text: string;
  modelId: string;
  modelGroupName: string;
  modelDisplayName: string;
  modelProviderModelId: string;
  time: string;
  createdAt?: string;
  mention: boolean;
  rank?: number | null;
  score: number;
  persona?: string | null;
  competitorsMentioned: string[];
  response: string;
};

type MonitoringCompetitor = {
  name: string;
};

type ProjectPromptInput = {
  id: string;
  text: string;
  intent?: string | null;
  type?: string | null;
  kind?: "monitoring" | "perception";
  modelIds?: string[];
  schedule?: Partial<PromptSchedule> | null;
  status?: "active" | "disabled" | "archived";
  isActive: boolean;
};

type BuildPromptPageItemsParams = {
  projectPrompts: ProjectPromptInput[];
  recentPrompts: MonitoringPromptInput[];
  competitors: MonitoringCompetitor[];
  availableModels: string[];
  stages: Stage[];
};

function resolveKnownModel(item: MonitoringPromptInput, availableModels: string[]) {
  const normalizedModel = normalizeModelName(
    item.modelId || item.modelProviderModelId || item.modelGroupName,
  );

  return (
    availableModels.find((model) => normalizeModelName(model) === normalizedModel) ||
    availableModels.find((model) =>
      normalizedModel.includes(normalizeModelName(model).split(" ")[0] || ""),
    ) ||
    item.modelId ||
    item.modelProviderModelId ||
    item.modelGroupName
  );
}

function toPromptStage(intent: string | null | undefined, fallbackStage: Stage): Stage {
  const normalized = (intent || "").trim().toLowerCase();
  if (normalized === "awareness") return "Awareness";
  if (normalized === "consideration") return "Consideration";
  if (normalized === "decision") return "Decision";
  return fallbackStage;
}

function buildHighlights(item: MonitoringPromptInput, score: number, competitor: string) {
  return [
    item.mention ? "Marque mentionnee" : "Marque absente",
    item.rank ? `Classement #${item.rank}` : "Aucun classement disponible",
    competitor && competitor !== "Aucun"
      ? `Concurrent principal : ${competitor}`
      : "Aucun concurrent detecte",
    `Score de visibilite ${score}`,
  ];
}

function dedupeCompetitors(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function buildTrend30dFromRuns(runs: Array<{ createdAt?: string; score: number }>) {
  const today = startOfUtcDay(new Date());
  const firstDay = new Date(today);
  firstDay.setUTCDate(today.getUTCDate() - 29);

  const dailyScores = new Map<string, number[]>();

  for (const run of runs) {
    if (!run.createdAt) continue;
    const createdAt = new Date(run.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;

    const runDay = startOfUtcDay(createdAt);
    if (runDay < firstDay || runDay > today) continue;

    const key = dayKey(runDay);
    const bucket = dailyScores.get(key) ?? [];
    bucket.push(Math.max(0, Math.min(100, run.score ?? 0)));
    dailyScores.set(key, bucket);
  }

  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(firstDay);
    day.setUTCDate(firstDay.getUTCDate() + index);
    const scores = dailyScores.get(dayKey(day));
    if (!scores || scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  });
}

function normalizePromptScheduleValue(input?: Partial<PromptSchedule> | null): PromptSchedule {
  const base = defaultPromptSchedule();
  return {
    mode: input?.mode === "per_model" ? "per_model" : "global",
    cron: input?.cron?.trim() || base.cron,
    timezone: input?.timezone?.trim() || base.timezone,
    modelCrons: Object.fromEntries(
      Object.entries(input?.modelCrons ?? {}).filter(
        ([modelId, cron]) => modelId.trim() !== "" && cron.trim() !== "",
      ),
    ),
  };
}

export function buildPromptPageItems({
  projectPrompts,
  recentPrompts,
  competitors,
  availableModels,
  stages,
}: BuildPromptPageItemsParams): PromptItem[] {
  const responsesByPromptId = recentPrompts.reduce(
    (map, item) => {
      if (!item.promptId) return map;
      const bucket = map.get(item.promptId) ?? [];
      bucket.push(item);
      map.set(item.promptId, bucket);
      return map;
    },
    new Map<string, MonitoringPromptInput[]>(),
  );

  return projectPrompts.map((projectPrompt, index) => {
    const schedule = normalizePromptScheduleValue(projectPrompt.schedule);
    const stage = toPromptStage(projectPrompt.intent, stages[index % stages.length] || "Awareness");
    const runsSource = [...(responsesByPromptId.get(projectPrompt.id) ?? [])].sort(
      (a, b) =>
        comparePromptRunsByRecency(
          { createdAt: a.createdAt, minutesAgo: parseRelativeTimeToMinutes(a.time) },
          { createdAt: b.createdAt, minutesAgo: parseRelativeTimeToMinutes(b.time) },
        ),
    );

    const runs = runsSource.map((item, runIndex) => {
      const model = resolveKnownModel(item, availableModels) as never;
      const minutes = parseRelativeTimeToMinutes(item.time);
      const score = Math.max(0, Math.min(100, item.score ?? 0));
      const competitorsMentioned = dedupeCompetitors(item.competitorsMentioned);
      const competitor = competitorsMentioned[0] || "Aucun";

      return {
        id: item.responseId || `${projectPrompt.id}-run-${runIndex + 1}`,
        time: item.time,
        createdAt: item.createdAt,
        model,
        minutesAgo: minutes,
        mention: item.mention,
        rank: item.rank ?? null,
        competitor,
        competitors: competitorsMentioned,
        score,
        error: item.mention ? null : "Aucune mention",
        critical: !item.mention && score <= 25,
        response: item.response || `Extrait de reponse pour "${projectPrompt.text}".`,
        highlights: buildHighlights(item, score, competitor),
      };
    });

    const mentionRate =
      runs.length > 0
        ? Math.round((runs.filter((item) => item.mention).length / runs.length) * 100)
        : 0;
    const rankedRuns = runs.filter((item) => typeof item.rank === "number");
    const avgRank =
      rankedRuns.length > 0
        ? Number(
            (
              rankedRuns.reduce((sum, item) => sum + (item.rank ?? 0), 0) / rankedRuns.length
            ).toFixed(1),
          )
        : null;
    const avgScore =
      runs.length > 0
        ? Math.round(runs.reduce((sum, item) => sum + item.score, 0) / runs.length)
        : 0;
    const lastRunMinutes =
      runs.length > 0 ? Math.min(...runs.map((item) => item.minutesAgo)) : 999999;
    const trend30d = buildTrend30dFromRuns(runs);
    const persistedPromptModels = (projectPrompt.modelIds ?? []).filter((model) =>
      availableModels.includes(model),
    );
    const promptModels =
      persistedPromptModels.length > 0
        ? persistedPromptModels
        : Array.from(
            new Set(
              runs.map((item) => item.model).filter((model) => availableModels.includes(model)),
            ),
          );
    const persona = runsSource.find((item) => item.persona?.trim())?.persona?.trim() || undefined;

    return {
      id: projectPrompt.id,
      sourcePromptId: projectPrompt.id,
      rowMode: "global",
      prompt: projectPrompt.text,
      type: projectPrompt.type?.trim() || null,
      kind: projectPrompt.kind === "perception" ? "perception" : "monitoring",
      stage,
      persona,
      models: promptModels,
      schedule,
      effectiveCron: schedule.cron,
      effectiveScheduleLabel: promptScheduleLabel(schedule),
      effectiveScheduleSource: "global",
      mentionRate,
      rank: avgRank,
      sov: avgScore,
      lastRunMinutes,
      trend30d,
      status: projectPrompt.status || (projectPrompt.isActive ? "active" : "disabled"),
      runs,
    };
  });
}

export function buildResponseRows({
  recentPrompts,
  competitors,
  availableModels,
  stages,
}: {
  recentPrompts: MonitoringPromptInput[];
  competitors: MonitoringCompetitor[];
  availableModels: string[];
  stages: Stage[];
}): PromptRunRow[] {
  return recentPrompts.map((item, index) => {
    const model = resolveKnownModel(item, availableModels) as never;
    const minutesAgo = parseRelativeTimeToMinutes(item.time);
    const score = Math.max(0, Math.min(100, item.score ?? 0));
    const competitorsMentioned = dedupeCompetitors(item.competitorsMentioned);
    const competitor = competitorsMentioned[0] || "Aucun";

    return {
      id: item.responseId || `response-${index + 1}`,
      promptId: item.promptId || `prompt-${index + 1}`,
      prompt: item.text,
      stage: stages[index % stages.length] || "Awareness",
      persona: item.persona?.trim() || undefined,
      models: [model],
      isHistorical: false,
      time: item.time,
      createdAt: item.createdAt,
      model,
      minutesAgo,
      mention: item.mention,
      rank: item.rank ?? null,
      competitor,
      competitors: competitorsMentioned,
      score,
      error: item.mention ? null : "Aucune mention",
      critical: !item.mention && score <= 25,
      response: item.response || `Extrait de reponse pour "${item.text}".`,
      highlights: buildHighlights(item, score, competitor),
    };
  });
}
