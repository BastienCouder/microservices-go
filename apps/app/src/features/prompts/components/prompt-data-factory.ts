import { PromptItem, PromptRunRow, PromptSchedule, Stage } from "./types";
import {
  defaultPromptSchedule,
  normalizeModelName,
  parseRelativeTimeToMinutes,
  promptScheduleLabel,
} from "./prompts-workspace-utils";

type MonitoringPromptInput = {
  responseId: string;
  promptId: string;
  text: string;
  modelId: string;
  modelGroupName: string;
  modelDisplayName: string;
  modelProviderModelId: string;
  time: string;
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
    competitor ? `Concurrent principal : ${competitor}` : "Aucun concurrent detecte",
    `Score de visibilite ${score}`,
  ];
}

function dedupeCompetitors(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
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
      (a, b) => parseRelativeTimeToMinutes(a.time) - parseRelativeTimeToMinutes(b.time),
    );

    const runs = runsSource.map((item, runIndex) => {
      const model = resolveKnownModel(item, availableModels) as never;
      const minutes = parseRelativeTimeToMinutes(item.time);
      const score = Math.max(0, Math.min(100, item.score ?? 0));
      const competitorsMentioned = dedupeCompetitors(
        item.competitorsMentioned.length > 0 ? item.competitorsMentioned : competitors[0]?.name ? [competitors[0].name] : [],
      );
      const competitor = competitorsMentioned[0] || "Aucun";

      return {
        id: item.responseId || `${projectPrompt.id}-run-${runIndex + 1}`,
        time: item.time,
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
        : 9.9;
    const avgScore =
      runs.length > 0
        ? Math.round(runs.reduce((sum, item) => sum + item.score, 0) / runs.length)
        : 0;
    const lastRunMinutes =
      runs.length > 0
        ? Math.min(...runs.map((item) => item.minutesAgo))
        : 999999;
    const trendSeed = runsSource.slice(0, 7).map((item) => Math.max(0, Math.min(100, item.score ?? 0)));
    const trend30d =
      trendSeed.length > 0
        ? Array.from({ length: 7 }, (_, trendIndex) => trendSeed[trendIndex] ?? trendSeed[trendSeed.length - 1] ?? 0)
        : [0, 0, 0, 0, 0, 0, 0];
    const promptModels = Array.from(
      new Set([
        ...(projectPrompt.modelIds ?? []),
        ...runs
          .map((item) => item.model)
          .filter((model) => availableModels.includes(model)),
      ]),
    );
    const persona = runsSource.find((item) => item.persona?.trim())?.persona?.trim() || undefined;

    return {
      id: projectPrompt.id,
      sourcePromptId: projectPrompt.id,
      rowMode: "global",
      prompt: projectPrompt.text,
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
    const competitorsMentioned = dedupeCompetitors(
      item.competitorsMentioned.length > 0 ? item.competitorsMentioned : competitors[0]?.name ? [competitors[0].name] : [],
    );
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

export function buildAutoGeneratedPrompts(
  availableModels: string[],
  availablePersonas: string[],
  stages: Stage[],
): PromptItem[] {
  const topics = [
    "startup CRM",
    "sales pipeline",
    "onboarding flow",
    "pricing page",
    "SMB conversion",
    "B2B integrations",
    "security compliance",
    "customer success",
    "sales enablement",
    "lead scoring",
  ];
  const modelPool = availableModels.length > 0 ? availableModels : ["ChatGPT"];
  const personaPool = availablePersonas;

  return Array.from({ length: 50 }).map((_, index) => {
    const topic = topics[index % topics.length];
    const id = `auto-${Date.now()}-${index}`;
    const model = modelPool[index % modelPool.length];
    const stage = stages[index % stages.length];
    const personaValue = personaPool.length > 0 ? personaPool[index % personaPool.length] : undefined;
    const schedule = defaultPromptSchedule();
    return {
      id,
      sourcePromptId: id,
      rowMode: "global",
      prompt: `Auto ${index + 1} : meilleure strategie ${topic} ?`,
      stage,
      persona: personaValue,
      models: [model as never],
      schedule,
      effectiveCron: schedule.cron,
      effectiveScheduleLabel: promptScheduleLabel(schedule),
      effectiveScheduleSource: "global",
      mentionRate: Math.max(5, 70 - index),
      rank: 1 + (index % 6) * 0.7,
      sov: Math.max(4, 38 - (index % 10)),
      lastRunMinutes: 15 + index * 8,
      trend30d: [8, 11, 15, 19, 24, 28, 31],
      status: "active",
      runs: [],
    };
  });
}

export function buildImportedPrompts(): PromptItem[] {
  const stamp = Date.now();
  const firstId = `csv-${stamp}-1`;
  const secondId = `csv-${stamp}-2`;
  const firstSchedule = defaultPromptSchedule();
  const secondSchedule = defaultPromptSchedule();

  return [
    {
      id: firstId,
      sourcePromptId: firstId,
      rowMode: "global",
      prompt: "Outil CRM pour agences avec reporting multi-marques",
      stage: "Consideration",
      models: ["ChatGPT", "Perplexity"] as never,
      schedule: firstSchedule,
      effectiveCron: firstSchedule.cron,
      effectiveScheduleLabel: promptScheduleLabel(firstSchedule),
      effectiveScheduleSource: "global",
      mentionRate: 51,
      rank: 2.4,
      sov: 34,
      lastRunMinutes: 40,
      trend30d: [28, 31, 33, 39, 43, 47, 51],
      status: "active",
      runs: [],
    },
    {
      id: secondId,
      sourcePromptId: secondId,
      rowMode: "global",
      prompt: "Meilleur CRM pipeline avec SOC2 et SSO",
      stage: "Decision",
      models: ["Claude", "Gemini"] as never,
      schedule: secondSchedule,
      effectiveCron: secondSchedule.cron,
      effectiveScheduleLabel: promptScheduleLabel(secondSchedule),
      effectiveScheduleSource: "global",
      mentionRate: 62,
      rank: 1.7,
      sov: 45,
      lastRunMinutes: 80,
      trend30d: [31, 36, 40, 42, 47, 54, 62],
      status: "active",
      runs: [],
    },
  ];
}
