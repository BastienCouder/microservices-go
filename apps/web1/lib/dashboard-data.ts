const MODEL_ICON_BY_HINT: Record<string, string> = {
  chatgpt: "/models/openai.svg",
  openai: "/models/openai.svg",
  perplexity: "/models/perplexity.svg",
  claude: "/models/claude.svg",
  anthropic: "/models/claude.svg",
  gemini: "/models/gemini.svg",
  google: "/models/gemini.svg",
  mistral: "/models/mistral.svg",
  copilot: "/models/copilot.svg",
  microsoft: "/models/copilot.svg",
};
const CHART_PALETTE = [
  "hsl(186 49% 62%)",
  "hsl(204 40% 47%)",
  "hsl(221 39% 34%)",
  "hsl(200 63% 68%)",
  "hsl(230 53% 58%)",
  "hsl(213 29% 45%)",
  "hsl(193 34% 56%)",
] as const;

const EMPTY_DASHBOARD_DATA = {
  project: {
    name: "",
    tagline: "",
    industry: "",
    competitors: [] as Array<{
      name: string;
      sov: number;
      trend: "up" | "down" | "stable";
      color?: string;
      mentions: number;
      website: string;
      initials: string;
    }>,
  },
  models: [] as Array<{
    id: string;
    name: string;
    provider?: string;
    description: string;
    live: boolean;
    icon: string;
  }>,
  kpis: {
    mention_rate: { value: "0%", trend: "", trendDir: "stable" as const, sub: "0 prompts" },
    visibility_score: { value: "0", trend: "", trendDir: "stable" as const, sub: "", badge: "" },
    avg_position: { value: "0", trend: "", trendDir: "stable" as const, sub: "" },
    sov: { value: "0%", sub: "", trend: "", topCompetitorValue: "0%" },
    prompts_covered: { value: "0", sub: "", footer: "" },
    ai_traffic: { value: "0", sub: "" },
  },
  trends: {
    visibility: [] as Array<Record<string, string | number>>,
    sov: [] as Array<Record<string, string | number>>,
    brand_visibility: [] as Array<Record<string, string | number>>,
  },
  clusters: [] as Array<{ title: string; score: string; alert: boolean }>,
  alerts: [] as Array<{ type: "critical" | "warning"; msg: string; prompts?: string; time?: string }>,
  recent_prompts: [] as Array<{
    text: string;
    model: string;
    modelIconKey?: string;
    modelFilterKey?: string;
    mention: boolean;
    rank: number | null;
    score: number;
    time: string;
    persona: string;
    competitorsMentioned: string[];
    createdAt?: string;
  }>,
  pagesStats: null as {
    pages: Array<{ pageUrl: string; citationShare?: number; citations?: number }>;
    totals: { citations?: number };
  } | null,
} as const;

export type DashboardData = typeof EMPTY_DASHBOARD_DATA;
export type DashboardPrompt = DashboardData["recent_prompts"][number];

export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

export interface ProjectApi {
  name?: string;
  brandName?: string;
  brandDescription?: string;
  industry?: string;
}

export interface PromptApi {
  id: string;
  text: string;
}

export interface CompetitorApi {
  name: string;
  domain?: string;
  websiteUrl?: string;
}

export interface ProjectModelApi {
  id: string;
  name?: string;
  label?: string;
  provider?: string;
  iconKey?: string | null;
  isActive?: boolean;
  supportsLiveSearch?: boolean;
  isEnabledForProject?: boolean;
}

export interface DashboardApi {
  hasData?: boolean;
  latestRun?: {
    id?: string;
    visibilityScore?: string | number | null;
    modelsSnapshot?: unknown;
    dashboardSnapshot?: unknown;
  } | null;
  visibilityScore?: number | null;
  promptRuns?: Array<{
    id?: string;
    promptId?: string;
    promptVisibilityScore?: string | number | null;
    brandMentioned?: boolean | null;
    promptTextSnapshot?: string | null;
    promptPersonaSnapshot?: string | null;
    timeLabelSnapshot?: string | null;
    topRank?: number | null;
    competitorsMentioned?: unknown;
    createdAt?: string | null;
    analysisRunId?: string | null;
  }>;
  aiResponses?: Array<{
    id?: string;
    promptRunId?: string;
    modelId?: string;
    modelDisplayName?: string | null;
    brandMentioned?: boolean | null;
    competitorsDetected?: unknown;
    responseScore?: string | number | null;
    responseRank?: number | null;
    promptPersonaSnapshot?: string | null;
    createdAt?: string | null;
  }>;
}

export interface AlertApi {
  alertType?: string;
  severity?: "low" | "medium" | "high";
  title?: string;
  description?: string | null;
  createdAt?: string;
}

export interface PagesStatsApi {
  success?: boolean;
  data?: {
    pages?: Array<{ pageUrl: string; citationShare?: number; citations?: number }>;
    totals?: { citations?: number };
  };
}

export interface DashboardFixtureApi {
  project?: ProjectApi;
  prompts?: PromptApi[];
  competitors?: CompetitorApi[];
  dashboard?: DashboardApi;
  alerts?: AlertApi[];
  meta?: {
    source?: string;
    projectId?: string;
    generatedAt?: string;
  };
}

type ModelItem = DashboardData["models"][number];
type CompetitorItem = DashboardData["project"]["competitors"][number];

function parseNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeModelId(raw: string): string {
  const value = raw.toLowerCase();
  if (value.includes("gpt") || value.includes("openai")) return "chatgpt";
  if (value.includes("perplexity")) return "perplexity";
  if (value.includes("claude")) return "claude";
  if (value.includes("gemini")) return "gemini";
  if (value.includes("mistral")) return "mistral";
  if (value.includes("copilot")) return "copilot";
  return value.replace(/[^a-z0-9]+/g, "-");
}

function normalizeModelName(raw: string): string {
  return raw;
}

function modelIconById(idOrKey: string): string {
  return MODEL_ICON_BY_HINT[idOrKey] || "/models/openai.svg";
}

function modelIconByKeyOrFallback(iconKey: string | null | undefined, normalizedId: string): string {
  if (iconKey) return modelIconById(iconKey.toLowerCase());
  return modelIconById(normalizedId);
}

function parseModelsSnapshot(input: unknown): DashboardData["models"] {
  if (!Array.isArray(input) || input.length === 0) return [];
  const rows = input
    .map((entry) => {
      const raw =
        typeof entry === "string"
          ? entry
          : typeof entry === "object" && entry
            ? String((entry as { label?: unknown; name?: unknown; id?: unknown }).label ?? (entry as { name?: unknown }).name ?? (entry as { id?: unknown }).id ?? "")
            : "";
      if (!raw) return null;
      const id = normalizeModelId(raw);
      return {
        id,
        name: raw,
        provider: undefined,
        description: "",
        live: true,
        icon: modelIconByKeyOrFallback(null, id),
      } satisfies ModelItem;
    })
    .filter((v): v is ModelItem => Boolean(v));
  return rows;
}

function parseProjectModels(input: ProjectModelApi[] | undefined): DashboardData["models"] | null {
  if (!input || input.length === 0) return null;
  const rows = input
    .filter((model) => model.isEnabledForProject && model.isActive !== false)
    .map((model) => {
      const raw = model.name || model.id;
      const label = model.label?.trim() || "";
      // Use the real DB id to avoid collisions when multiple models share the same provider/family.
      const id = model.id;
      return {
        id,
        name: label || normalizeModelName(raw),
        provider: model.provider,
        description: raw,
        live: true,
        icon: modelIconByKeyOrFallback(model.iconKey, normalizeModelId(raw)),
      } satisfies ModelItem;
    });
  return rows.length > 0 ? rows : null;
}

function parseDashboardSnapshot(input: unknown): { visibilityTrend: number[]; mentionRate?: number } {
  if (!input || typeof input !== "object") return { visibilityTrend: [] };
  const snapshot = input as { visibilityTrend?: unknown; mentionRate?: unknown };
  const visibilityTrend = Array.isArray(snapshot.visibilityTrend)
    ? snapshot.visibilityTrend.map((v) => clamp(parseNumber(v, 0), 0, 100)).filter((v) => Number.isFinite(v))
    : [];
  const mentionRate = snapshot.mentionRate == null ? undefined : clamp(parseNumber(snapshot.mentionRate, 0), 0, 100);
  return { visibilityTrend, mentionRate };
}

function buildVisibilityTrend(models: DashboardData["models"], baseTrend: number[]) {
  const points = baseTrend.map((base, index) => {
    const row: Record<string, string | number> = { date: `P${index + 1}` };
    models.forEach((model, modelIndex) => {
      const delta = ((modelIndex % 3) - 1) * 4 + (index % 2 === 0 ? 2 : -1);
      row[model.id] = clamp(Math.round(base + delta), 0, 100);
    });
    return row;
  });
  return points;
}

function buildBrandVisibilityTrend(
  brandName: string,
  competitors: CompetitorItem[],
  baseTrend: number[],
): DashboardData["trends"]["brand_visibility"] {
  const brandKey = (brandName || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const compKeys = competitors.slice(0, 3).map((c, i) => ({
    key: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `comp_${i + 1}`,
    offset: 8 - i * 4,
  }));
  return baseTrend.map((base, index) => {
    const row: Record<string, string | number> = { date: `P${index + 1}` };
    row[brandKey] = clamp(Math.round(base / 2 + 5 + index), 0, 100);
    compKeys.forEach((comp, i) => {
      row[comp.key] = clamp(Math.round((base / 2 + comp.offset) - i - (index % 2)), 0, 100);
    });
    return row;
  });
}

function buildSovTrend(mentionRate: number): DashboardData["trends"]["sov"] {
  const brand = clamp(Math.round(mentionRate / 2), 8, 80);
  return [0, 1, 2].map((week) => {
    const brandValue = clamp(brand + week * 2, 0, 100);
    const comp1 = clamp(100 - brandValue - 20, 0, 100);
    const comp2 = 12;
    const other = clamp(100 - brandValue - comp1 - comp2, 0, 100);
    return { date: `W${week + 1}`, brand: brandValue, comp1, comp2, other };
  });
}

function clusterTitleFromPrompt(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("running") || lower.includes("marathon")) return "Running";
  if (lower.includes("training") || lower.includes("entraînement")) return "Training";
  if (lower.includes("lifestyle") || lower.includes("sneaker")) return "Lifestyle";
  if (lower.includes("prix") || lower.includes("chère")) return "Prix / Valeur";
  return "Comparatifs";
}

function buildClusters(prompts: DashboardData["recent_prompts"], alertsCount: number): DashboardData["clusters"] {
  const buckets = new Map<string, { count: number; avg: number }>();
  prompts.forEach((p) => {
    const key = clusterTitleFromPrompt(p.text);
    const current = buckets.get(key) ?? { count: 0, avg: 0 };
    current.avg = (current.avg * current.count + p.score) / (current.count + 1);
    current.count += 1;
    buckets.set(key, current);
  });
  return Array.from(buckets.entries())
    .slice(0, 4)
    .map(([title, stats], index) => ({
      title,
      score: stats.avg >= 75 ? "A" : stats.avg >= 62 ? "B" : "C",
      alert: alertsCount > 0 && index === 0 ? true : stats.avg < 60,
    }));
}

function parseCompetitorNames(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") return String((entry as { name?: unknown }).name ?? "");
      return "";
    })
    .filter((value): value is string => value.length > 0);
}

function parseAiResponseScore(value: unknown, fallback: number): number {
  const parsed = parseNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapDashboardData(input: {
  project?: ProjectApi;
  prompts?: PromptApi[];
  competitors?: CompetitorApi[];
  projectModels?: ProjectModelApi[];
  dashboard?: DashboardApi;
  alerts?: AlertApi[];
  pagesStats?: PagesStatsApi;
}): DashboardData {
  const project = input.project || {};
  const prompts = input.prompts || [];
  const competitors = input.competitors || [];
  const dashboard = input.dashboard || {};
  const alerts = input.alerts || [];
  const latestRun = dashboard.latestRun || null;
  const snapshot = parseDashboardSnapshot(latestRun?.dashboardSnapshot);
  const models = parseProjectModels(input.projectModels) ?? parseModelsSnapshot(latestRun?.modelsSnapshot);
  const projectModelsByRawId = new Map((input.projectModels || []).map((m) => [m.id, m]));

  const promptTextById = new Map(prompts.map((prompt) => [prompt.id, prompt.text]));
  const promptRunsInput = (dashboard.promptRuns || []).filter((run) => Boolean(run.promptId));
  const aiResponsesByPromptRunId = new Map<string, NonNullable<DashboardApi["aiResponses"]>>();
  for (const response of dashboard.aiResponses || []) {
    const key = response.promptRunId || "";
    if (!key) continue;
    const current = aiResponsesByPromptRunId.get(key) ?? [];
    current.push(response);
    aiResponsesByPromptRunId.set(key, current);
  }

  const recentPrompts = promptRunsInput
    .flatMap((promptRun) => {
      const score = Number(promptRun.promptVisibilityScore ?? 0);
      const promptText =
        promptRun.promptTextSnapshot ||
        promptTextById.get(promptRun.promptId || "") ||
        "";
      const responseRows =
        (promptRun.id ? aiResponsesByPromptRunId.get(promptRun.id) : undefined)?.slice() ?? [];

      if (responseRows.length === 0) {
        const mention = Boolean(promptRun.brandMentioned ?? false);
        return [{
          text: promptText,
          model: "",
          modelIconKey: undefined,
          modelFilterKey: undefined,
          mention,
          rank:
            mention && promptRun.topRank != null
              ? Math.max(1, Math.round(parseNumber(promptRun.topRank, 0)))
              : null,
          score: Number.isFinite(score) ? score : 0,
          time: promptRun.timeLabelSnapshot || "",
          persona: promptRun.promptPersonaSnapshot || "",
          competitorsMentioned: parseCompetitorNames(promptRun.competitorsMentioned),
          createdAt: promptRun.createdAt || undefined,
        }];
      }

      return responseRows.map((response) => {
        const modelMeta = response.modelId ? projectModelsByRawId.get(response.modelId) : undefined;
        const modelRawName = modelMeta?.name || response.modelId || modelMeta?.label || "";
        // Filter/group charts by the exact backend model id when available.
        const modelFilterKey = response.modelId || modelMeta?.id || (modelRawName ? normalizeModelId(modelRawName) : undefined);
        const modelLabel =
          modelMeta?.label?.trim() ||
          response.modelDisplayName ||
          modelMeta?.name ||
          response.modelId ||
          "";
        const mention = Boolean(response.brandMentioned ?? promptRun.brandMentioned ?? false);

        return {
          text: promptText,
          model: modelLabel,
          modelIconKey: modelMeta?.iconKey ?? undefined,
          modelFilterKey,
          mention,
          rank:
            mention && (response.responseRank ?? promptRun.topRank) != null
              ? Math.max(1, Math.round(parseNumber(response.responseRank ?? promptRun.topRank, 0)))
              : null,
          score: parseAiResponseScore(response.responseScore, Number.isFinite(score) ? score : 0),
          time: promptRun.timeLabelSnapshot || "",
          persona: response.promptPersonaSnapshot || promptRun.promptPersonaSnapshot || "",
          competitorsMentioned: parseCompetitorNames(response.competitorsDetected ?? promptRun.competitorsMentioned),
          createdAt: response.createdAt || promptRun.createdAt || undefined,
        };
      });
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 200);

  const mentionRate = recentPrompts.length
    ? Math.round((recentPrompts.filter((p) => p.mention).length / recentPrompts.length) * 100)
    : 0;
  const visibilityScore =
    parseNumber(dashboard.visibilityScore, Number.NaN) ||
    parseNumber(latestRun?.visibilityScore, Number.NaN) ||
    (recentPrompts.length
      ? Math.round(recentPrompts.reduce((sum, p) => sum + p.score, 0) / recentPrompts.length)
      : 0);
  const avgPositionRaw = recentPrompts.filter((p) => p.rank).map((p) => p.rank as number);
  const avgPosition = avgPositionRaw.length
    ? (avgPositionRaw.reduce((sum, rank) => sum + rank, 0) / avgPositionRaw.length).toFixed(1)
    : "0";
  const competitorMentionsEstimate = Math.round((recentPrompts.length || 1) * 6.5);
  const topCompetitorMentions = Math.max(1, Math.round(competitorMentionsEstimate * 0.42));
  const brandSov = clamp(Math.round(mentionRate / 2), 0, 100);
  const visibilityTrend = buildVisibilityTrend(models, snapshot.visibilityTrend);
  const brandVisibilityTrend = buildBrandVisibilityTrend(
    project.brandName || project.name || "brand",
    competitors.length > 0
      ? competitors.map((competitor, i) => ({
        name: competitor.name,
        sov: 0,
        trend: "stable" as const,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
        mentions: Math.max(1, Math.round(topCompetitorMentions * (1 - i * 0.18))),
        website: competitor.websiteUrl || competitor.domain || "",
        initials: competitor.name.slice(0, 2),
      }))
      : [],
    snapshot.visibilityTrend,
  );
  const sovTrend = buildSovTrend(snapshot.mentionRate ?? mentionRate);
  const mappedAlerts =
    alerts.length > 0
      ? alerts.map((alert) => ({
        type: alert.severity === "high" ? "critical" : "warning",
        msg: alert.title || alert.description || "Alert",
        prompts: alert.alertType || "",
        time: alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : "",
      }))
      : [];

  return {
    ...EMPTY_DASHBOARD_DATA,
    models,
    project: {
      ...EMPTY_DASHBOARD_DATA.project,
      name: project.brandName || project.name || "",
      tagline: project.brandDescription || "",
      industry: project.industry || "",
      competitors:
        competitors.length > 0
          ? competitors.map((competitor, i) => ({
            name: competitor.name,
            sov: Math.max(4, Math.round((100 - brandSov) / Math.max(competitors.length, 1)) - i),
            trend: "stable",
            color: CHART_PALETTE[i % CHART_PALETTE.length],
            mentions: Math.max(1, Math.round(topCompetitorMentions * (1 - i * 0.18))),
            website: competitor.websiteUrl || competitor.domain || "",
            initials: competitor.name.slice(0, 2),
          }))
          : [],
    },
    recent_prompts: recentPrompts,
    alerts: mappedAlerts,
    pagesStats: input.pagesStats?.data ? {
      pages: input.pagesStats.data.pages ?? [],
      totals: { citations: input.pagesStats.data.totals?.citations ?? 0 },
    } : null,
    trends: {
      visibility: visibilityTrend,
      brand_visibility: brandVisibilityTrend,
      sov: sovTrend,
    },
    clusters: buildClusters(recentPrompts, mappedAlerts.length),
    kpis: {
      ...EMPTY_DASHBOARD_DATA.kpis,
      mention_rate: {
        ...EMPTY_DASHBOARD_DATA.kpis.mention_rate,
        value: `${mentionRate}%`,
        trend: snapshot.mentionRate != null ? `${snapshot.mentionRate}% run` : "",
        trendDir: "up",
        sub: `${recentPrompts.length} prompts`,
      },
      visibility_score: {
        ...EMPTY_DASHBOARD_DATA.kpis.visibility_score,
        value: `${Math.round(visibilityScore)} / 100`,
        trend: snapshot.visibilityTrend.length > 1
          ? `${Math.round(snapshot.visibilityTrend.at(-1)! - snapshot.visibilityTrend[0]) >= 0 ? "+" : ""}${Math.round(
            snapshot.visibilityTrend.at(-1)! - snapshot.visibilityTrend[0],
          )} vs run précédent`
          : "",
        trendDir:
          snapshot.visibilityTrend.length > 1 && snapshot.visibilityTrend.at(-1)! < snapshot.visibilityTrend[0]
            ? "down"
            : "up",
        sub: "Score combiné mention × position × sentiment",
      },
      avg_position: {
        ...EMPTY_DASHBOARD_DATA.kpis.avg_position,
        value: avgPosition,
        sub: "Sur les réponses où la marque est citée",
      },
      sov: {
        ...EMPTY_DASHBOARD_DATA.kpis.sov,
        value: `${brandSov}%`,
        sub: `vs ${competitors.length} concurrents`,
        topCompetitorValue: `${Math.max(0, Math.round((100 - brandSov) / Math.max(competitors.length || 1, 1)))}%`,
      },
      prompts_covered: {
        ...EMPTY_DASHBOARD_DATA.kpis.prompts_covered,
        value: `${recentPrompts.length} actifs`,
        sub: "Prompts backend",
      },
      ai_traffic: {
        ...EMPTY_DASHBOARD_DATA.kpis.ai_traffic,
        value: String(recentPrompts.filter((p) => p.mention).length * Math.max(models.length, 1) * 8),
        sub: "Estimation backend",
      },
    },
  };
}
