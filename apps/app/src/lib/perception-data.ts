import { apiRoutes } from "@/lib/api-config";
import {
  PERCEPTION_AXIS_LABELS,
  PERCEPTION_HEATMAP_AXIS_COLORS,
  PERCEPTION_PERIOD_LABELS,
  PERCEPTION_VISIBLE_AXES,
} from "@/lib/app-data";
import {
  buildProjectModelLookup,
  normalizeModelPayloadList,
  toProjectModelMeta,
  type ProjectModelMeta,
} from "@/lib/project-models";
import type { RuntimeMode } from "@/lib/runtime-mode";
import { resolveRuntimeMode } from "@/lib/runtime-mode";
import { gatewayJSON } from "@/shared/api/gateway";

export type PerceptionAxisKey =
  | "positioning"
  | "pricing"
  | "use_cases"
  | "features"
  | "sentiment"
  | "competitors";

export type PerceptionSeverity = "high" | "medium" | "low";
export type OptimizePriority = "high" | "medium" | "low";
export type PerceptionTrendPeriodKey = keyof typeof PERCEPTION_PERIOD_LABELS;

export type BrandCanon = {
  brandName: string;
  category: string;
  positioning: string;
  audience: string[];
  useCases: string[];
  pricing: {
    amount: number;
    currency: string;
    period: string;
    note?: string;
  };
  features: string[];
};

export type BrandCompetitor = {
  id?: string;
  name: string;
  website: string;
};

export type PerceptionRadarPoint = {
  axis: PerceptionAxisKey;
  label: string;
  score: number;
  target: number;
};

export type PerceptionScores = {
  positioningAccuracy: number;
  factualAccuracy: number;
  sentimentScore: number;
};

export type PerceptionError = {
  id: string;
  severity: PerceptionSeverity;
  title: string;
  issue: string;
  impact: string;
  detectedInModels: string[];
  fixType: "prompt_patch" | "website_copy" | "schema_update" | "faq_snippet";
  generatedContent: string;
  optimizePriority: OptimizePriority;
  type: string;
};

export type PerceptionHeatmapAxis = {
  key: string;
  label: string;
  color: string;
};

export type PerceptionHeatmapRow = {
  model: string;
  values: Record<string, number>;
};

export type PerceptionTrendPoint = {
  label: string;
  positioning: number;
  factual: number;
  sentiment: number;
};

export type PerceptionTrendSeries = {
  periodLabel: string;
  data: PerceptionTrendPoint[];
};

export type PerceptionResponseRecord = {
  id: string;
  runId: string;
  promptRunId: string;
  modelId: string;
  modelName: string;
  modelGroupName: string;
  createdAt: string | null;
  brandMentioned: boolean;
  citationFound: boolean;
  sentiment: "positive" | "neutral" | "negative";
  brandPosition: string;
  metrics: {
    positioning: number;
    factual: number;
    use_cases: number;
    features: number;
    sentiment: number;
    competitors: number;
  };
};

export type PerceptionModelOption = ProjectModelMeta;

export type PerceptionViewData = {
  source: "project" | "fallback" | "demo";
  brandCanon: BrandCanon;
  competitors: BrandCompetitor[];
  radar: PerceptionRadarPoint[];
  scores: PerceptionScores;
  topErrors: PerceptionError[];
  modelAxisHeatmap: {
    axes: PerceptionHeatmapAxis[];
    rows: PerceptionHeatmapRow[];
  };
  trend: Record<PerceptionTrendPeriodKey, PerceptionTrendSeries>;
  responses: PerceptionResponseRecord[];
  metadata: {
    brandId?: string;
    projectId?: string | null;
    windowLabel: string;
    analyzedResponses: number;
    models: string[];
    projectModels?: string[];
    modelCatalog: PerceptionModelOption[];
    generatedAt: string;
    latestRunId?: string;
    runtimeMode: RuntimeMode;
  };
};

type PerceptionApiPayload = {
  brandCanon?: Partial<BrandCanon> & {
    pricing?: Partial<BrandCanon["pricing"]>;
  };
  scores?: Partial<PerceptionScores>;
  radar?: Array<Partial<PerceptionRadarPoint>>;
  topErrors?: Array<Partial<PerceptionError>>;
  metadata?: Partial<PerceptionViewData["metadata"]>;
};

type JsonObject = Record<string, unknown>;

type ParsedResponse = {
  id: string;
  runId: string;
  promptRunId: string;
  modelId: string;
  modelName: string;
  modelGroupName: string;
  createdAt: Date | null;
  brandMentioned: boolean;
  citationFound: boolean;
  sentiment: "positive" | "neutral" | "negative";
  brandPosition: string;
  metrics: {
    positioning: number;
    factual: number;
    use_cases: number;
    features: number;
    sentiment: number;
    competitors: number;
  };
};

type MonitoringRequestScope = "projects" | "project" | "models" | "competitors" | "monitoring" | "perception";

type TrendAccumulator = {
  positioning: number;
  factual: number;
  sentiment: number;
  count: number;
};

export type PerceptionLoadResult = {
  data: PerceptionViewData;
  projectId: string | null;
  mode: RuntimeMode;
};

export class PerceptionRequestError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message || "perception request failed");
    this.name = "PerceptionRequestError";
    this.status = status;
  }
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function getField<T = unknown>(obj: JsonObject, keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in obj) {
      return obj[key] as T;
    }
  }
  return undefined;
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  const obj = asObject(value);
  if (obj.success === true && "data" in obj) {
    return obj.data;
  }
  return value;
}

function unwrapRequiredEnvelope<T>(
  result: Awaited<ReturnType<typeof gatewayJSON<T>>>,
  scope: MonitoringRequestScope,
): unknown {
  if (!result.ok) {
    throw new PerceptionRequestError(result.status, `${scope}: ${result.error}`);
  }
  return unwrapSuccessEnvelope(result.data);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readProjectIdFromSearch(routeSearch: string): string | null {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  const value = params.get("projectId") || params.get("project_id") || params.get("project") || "";
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function encodeProjectPathSegment(projectId: string): string {
  return encodeURIComponent(projectId);
}

function parseISODate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfUTCDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDayLabel(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatWeekLabel(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `Semaine ${day}/${month}`;
}

function startOfUTCWeek(value: Date): Date {
  const day = value.getUTCDay() || 7;
  return startOfUTCDay(addDays(value, 1 - day));
}

function daysForPeriod(period: Exclude<PerceptionTrendPeriodKey, "all" | "last-run">): number {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  return 90;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeSentiment(value: string): "positive" | "neutral" | "negative" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "positive") return "positive";
  if (normalized === "negative") return "negative";
  return "neutral";
}

function positionScore(brandPosition: string, brandMentioned: boolean): number {
  const normalized = brandPosition.trim().toLowerCase();
  if (normalized === "top" || normalized === "first" || normalized === "1") return 100;
  if (normalized === "second" || normalized === "2") return 72;
  if (normalized === "third" || normalized === "3") return 48;
  if (normalized === "mid" || normalized === "middle") return 58;
  if (normalized === "low" || normalized === "bottom") return 28;
  if (brandMentioned) return 64;
  return 15;
}

function factualScore(brandMentioned: boolean, citationFound: boolean): number {
  if (citationFound) return 100;
  if (brandMentioned) return 40;
  return 10;
}

function featureScore(brandMentioned: boolean, citationFound: boolean): number {
  if (citationFound) return 100;
  if (brandMentioned) return 55;
  return 15;
}

function sentimentScore(sentiment: "positive" | "neutral" | "negative"): number {
  if (sentiment === "positive") return 100;
  if (sentiment === "neutral") return 60;
  return 25;
}

function useCaseScore(brandMentioned: boolean): number {
  return brandMentioned ? 100 : 20;
}

function parseResponses(
  payload: unknown,
  modelLookup: Map<string, PerceptionModelOption>,
): ParsedResponse[] {
  const monitoring = asObject(payload);
  const responses = asArray(getField(monitoring, ["aiResponses", "responses", "Responses"])).map(asObject);

  return responses.map((response) => {
    const modelId =
      asString(getField(response, ["modelId", "ModelID"])) ||
      asString(getField(response, ["model", "Model"]));
    const brandMentioned = asBool(getField(response, ["brandMentioned", "BrandMentioned"]));
    const citationFound = asBool(getField(response, ["citationFound", "CitationFound"]));
    const sentiment = normalizeSentiment(asString(getField(response, ["sentiment", "Sentiment"])));
    const brandPosition = asString(getField(response, ["brandPosition", "BrandPosition"]));
    const modelMeta = modelLookup.get(modelId.trim().toLowerCase()) || null;

    return {
      id: asString(getField(response, ["id", "ID"])),
      runId: asString(getField(response, ["runId", "RunID"])),
      promptRunId: asString(getField(response, ["promptRunId", "PromptRunID"])),
      modelId,
      modelName: modelMeta?.displayName || modelId,
      modelGroupName: modelMeta?.groupName || modelMeta?.displayName || modelId,
      createdAt: parseISODate(asString(getField(response, ["createdAt", "CreatedAt"]))),
      brandMentioned,
      citationFound,
      sentiment,
      brandPosition,
      metrics: {
        positioning: positionScore(brandPosition, brandMentioned),
        factual: factualScore(brandMentioned, citationFound),
        use_cases: useCaseScore(brandMentioned),
        features: featureScore(brandMentioned, citationFound),
        sentiment: sentimentScore(sentiment),
        competitors: positionScore(brandPosition, brandMentioned),
      },
    };
  });
}

function parseProjectModelFilter(value: unknown): Set<string> {
  const modelIDs = asArray(value)
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return new Set(modelIDs);
}

function filterResponsesToProjectModels(
  responses: ParsedResponse[],
  projectModelFilter: Set<string>,
): ParsedResponse[] {
  if (projectModelFilter.size === 0) {
    return responses;
  }

  return responses.filter((response) => projectModelFilter.has(response.modelId));
}

function deriveScores(
  payload: PerceptionApiPayload,
  responses: ParsedResponse[],
): PerceptionScores {
  const analyzed = responses.length;
  const mentionRate =
    analyzed === 0
      ? 0
      : clampScore((responses.filter((response) => response.brandMentioned).length / analyzed) * 100);
  const citationRate =
    analyzed === 0
      ? 0
      : clampScore((responses.filter((response) => response.citationFound).length / analyzed) * 100);
  const sentimentAverage = clampScore(average(responses.map((response) => response.metrics.sentiment)));

  return {
    positioningAccuracy: clampScore(asNumber(payload.scores?.positioningAccuracy ?? mentionRate)),
    factualAccuracy: clampScore(asNumber(payload.scores?.factualAccuracy ?? citationRate)),
    sentimentScore: clampScore(asNumber(payload.scores?.sentimentScore ?? sentimentAverage)),
  };
}

function deriveScoresFromParsedResponses(responses: ParsedResponse[]): PerceptionScores {
  return {
    positioningAccuracy: clampScore(average(responses.map((response) => response.metrics.positioning))),
    factualAccuracy: clampScore(average(responses.map((response) => response.metrics.factual))),
    sentimentScore: clampScore(average(responses.map((response) => response.metrics.sentiment))),
  };
}

function deriveWindowLabel(responses: ParsedResponse[], referenceDate: Date): string {
  const dates = responses.map((response) => response.createdAt).filter((value): value is Date => value !== null);
  if (dates.length === 0) {
    return PERCEPTION_PERIOD_LABELS["30d"];
  }

  const earliest = dates.reduce((min, current) => (current.getTime() < min.getTime() ? current : min), dates[0]!);
  const diffDays = Math.max(0, Math.ceil((referenceDate.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000)));

  if (diffDays <= 7) return PERCEPTION_PERIOD_LABELS["7d"];
  if (diffDays <= 30) return PERCEPTION_PERIOD_LABELS["30d"];
  if (diffDays <= 90) return PERCEPTION_PERIOD_LABELS["90d"];
  return "Historique complet";
}

function deriveLatestRunIdFromResponses(
  responses: ParsedResponse[],
  fallbackLatestRunId: string,
): string {
  let latestRunId = "";
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const response of responses) {
    if (!response.runId) {
      continue;
    }
    const timestamp = response.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (timestamp >= latestTimestamp) {
      latestTimestamp = timestamp;
      latestRunId = response.runId;
    } else if (latestRunId === "") {
      latestRunId = response.runId;
    }
  }

  return latestRunId || fallbackLatestRunId;
}

function deriveBrandCanon(projectPayload: unknown): BrandCanon {
  const project = asObject(projectPayload);
  const brandName =
    asString(getField(project, ["brandName", "BrandName"])) ||
    asString(getField(project, ["name", "Name"]));
  const category = asString(getField(project, ["industry", "Industry"]));
  const positioning =
    asString(getField(project, ["brandDescription", "BrandDescription"])) ||
    asString(getField(project, ["websiteUrl", "WebsiteURL"])) ||
    asString(getField(project, ["domain", "Domain"]));

  return {
    brandName,
    category,
    positioning,
    audience: [],
    useCases: [],
    pricing: {
      amount: 0,
      currency: "",
      period: "",
      note: "",
    },
    features: [],
  };
}

function parseCompetitors(payload: unknown): BrandCompetitor[] {
  return asArray(payload)
    .map(asObject)
    .map((row) => ({
      id: asString(getField(row, ["id", "ID"])).trim() || undefined,
      name: asString(getField(row, ["name", "Name"])).trim(),
      website:
        asString(getField(row, ["websiteUrl", "WebsiteURL"])).trim() ||
        asString(getField(row, ["domain", "Domain"])).trim(),
    }))
    .filter((entry) => entry.name !== "");
}

function deriveRadar(
  payload: PerceptionApiPayload,
  responses: ParsedResponse[],
): PerceptionRadarPoint[] {
  const averageByAxis: Record<"positioning" | "use_cases" | "features" | "sentiment" | "competitors", number> = {
    positioning: clampScore(average(responses.map((response) => response.metrics.positioning))),
    use_cases: clampScore(average(responses.map((response) => response.metrics.use_cases))),
    features: clampScore(average(responses.map((response) => response.metrics.features))),
    sentiment: clampScore(average(responses.map((response) => response.metrics.sentiment))),
    competitors: clampScore(average(responses.map((response) => response.metrics.competitors))),
  };

  return PERCEPTION_VISIBLE_AXES.map((axis) => {
    const incoming = payload.radar?.find((entry) => entry.axis === axis);
    return {
      axis,
      label: incoming?.label || PERCEPTION_AXIS_LABELS[axis],
      score: averageByAxis[axis],
      target: clampScore(asNumber(incoming?.target ?? 100)),
    };
  });
}

function deriveRadarFromParsedResponses(responses: ParsedResponse[]): PerceptionRadarPoint[] {
  const averageByAxis: Record<"positioning" | "use_cases" | "features" | "sentiment" | "competitors", number> = {
    positioning: clampScore(average(responses.map((response) => response.metrics.positioning))),
    use_cases: clampScore(average(responses.map((response) => response.metrics.use_cases))),
    features: clampScore(average(responses.map((response) => response.metrics.features))),
    sentiment: clampScore(average(responses.map((response) => response.metrics.sentiment))),
    competitors: clampScore(average(responses.map((response) => response.metrics.competitors))),
  };

  return PERCEPTION_VISIBLE_AXES.map((axis) => ({
    axis,
    label: PERCEPTION_AXIS_LABELS[axis],
    score: averageByAxis[axis],
    target: 100,
  }));
}

function deriveModelAxisHeatmap(
  responses: ParsedResponse[],
  modelCatalog: PerceptionModelOption[],
): PerceptionViewData["modelAxisHeatmap"] {
  const axes: PerceptionHeatmapAxis[] = PERCEPTION_VISIBLE_AXES.map((axis) => ({
    key: axis,
    label: PERCEPTION_AXIS_LABELS[axis],
    color: PERCEPTION_HEATMAP_AXIS_COLORS[axis] ?? "hsl(var(--primary))",
  }));

  const responseGroups = new Map<string, ParsedResponse[]>();
  for (const response of responses) {
    const key = response.modelGroupName || response.modelName || response.modelId;
    const existing = responseGroups.get(key);
    if (existing) {
      existing.push(response);
      continue;
    }
    responseGroups.set(key, [response]);
  }

  const orderedModelNames = uniqueStrings([
    ...modelCatalog.map((model) => model.groupName || model.displayName || model.id),
    ...responses.map((response) => response.modelGroupName || response.modelName || response.modelId),
  ]).filter((modelName) => responseGroups.has(modelName));

  const rows: PerceptionHeatmapRow[] = orderedModelNames.map((modelName) => {
    const modelResponses = responseGroups.get(modelName) ?? [];

    return {
      model: modelName,
      values: {
        positioning: clampScore(average(modelResponses.map((response) => response.metrics.positioning))),
        use_cases: clampScore(average(modelResponses.map((response) => response.metrics.use_cases))),
        features: clampScore(average(modelResponses.map((response) => response.metrics.features))),
        sentiment: clampScore(average(modelResponses.map((response) => response.metrics.sentiment))),
        competitors: clampScore(average(modelResponses.map((response) => response.metrics.competitors))),
      },
    };
  });

  return { axes, rows };
}

function deriveModelAxisHeatmapFromParsedResponses(
  responses: ParsedResponse[],
  options?: {
    groupByModelFamily?: boolean;
  },
): PerceptionViewData["modelAxisHeatmap"] {
  const axes: PerceptionHeatmapAxis[] = PERCEPTION_VISIBLE_AXES.map((axis) => ({
    key: axis,
    label: PERCEPTION_AXIS_LABELS[axis],
    color: PERCEPTION_HEATMAP_AXIS_COLORS[axis] ?? "hsl(var(--primary))",
  }));

  const responseGroups = new Map<string, ParsedResponse[]>();
  for (const response of responses) {
    const key =
      options?.groupByModelFamily === false
        ? response.modelName || response.modelId
        : response.modelGroupName || response.modelName || response.modelId;
    const existing = responseGroups.get(key);
    if (existing) {
      existing.push(response);
      continue;
    }
    responseGroups.set(key, [response]);
  }

  const rows: PerceptionHeatmapRow[] = Array.from(responseGroups.entries()).map(([modelName, modelResponses]) => {
    return {
      model: modelName,
      values: {
        positioning: clampScore(average(modelResponses.map((response) => response.metrics.positioning))),
        use_cases: clampScore(average(modelResponses.map((response) => response.metrics.use_cases))),
        features: clampScore(average(modelResponses.map((response) => response.metrics.features))),
        sentiment: clampScore(average(modelResponses.map((response) => response.metrics.sentiment))),
        competitors: clampScore(average(modelResponses.map((response) => response.metrics.competitors))),
      },
    };
  });

  return { axes, rows };
}

function buildTrendDataFromAccumulator(
  entries: ReadonlyArray<readonly [Date, TrendAccumulator]>,
  labeler: (date: Date) => string,
) {
  return entries.map(([date, bucket]) => ({
    label: labeler(date),
    positioning: clampScore(bucket.positioning / bucket.count),
    factual: clampScore(bucket.factual / bucket.count),
    sentiment: clampScore(bucket.sentiment / bucket.count),
  }));
}

function accumulateTrendBuckets(
  responses: ParsedResponse[],
  keyForResponse: (response: ParsedResponse) => Date | null,
): Map<number, TrendAccumulator> {
  const buckets = new Map<number, TrendAccumulator>();

  for (const response of responses) {
    const bucketDate = keyForResponse(response);
    if (!bucketDate) continue;
    const key = bucketDate.getTime();
    const current = buckets.get(key) ?? { positioning: 0, factual: 0, sentiment: 0, count: 0 };
    current.positioning += response.metrics.positioning;
    current.factual += response.metrics.factual;
    current.sentiment += response.metrics.sentiment;
    current.count += 1;
    buckets.set(key, current);
  }

  return buckets;
}

function buildPeriodTrendData(
  responses: ParsedResponse[],
  referenceDate: Date,
  days: number,
  bucket: "day" | "week",
): PerceptionTrendPoint[] {
  const minDate = addDays(startOfUTCDay(referenceDate), -(days - 1));
  const filtered = responses.filter(
    (response) => response.createdAt !== null && response.createdAt.getTime() >= minDate.getTime(),
  );

  const buckets = accumulateTrendBuckets(filtered, (response) => {
    if (!response.createdAt) return null;
    return bucket === "week" ? startOfUTCWeek(response.createdAt) : startOfUTCDay(response.createdAt);
  });

  const entries = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, accumulator]) => [new Date(timestamp), accumulator] as const);

  if (bucket === "week") {
    return buildTrendDataFromAccumulator(entries, formatWeekLabel);
  }
  return buildTrendDataFromAccumulator(entries, formatDayLabel);
}

function buildLastRunTrendData(
  responses: ParsedResponse[],
  latestRunId: string,
  referenceDate: Date,
): PerceptionTrendPoint[] {
  const relevant = latestRunId
    ? responses.filter((response) => response.runId === latestRunId)
    : responses;

  if (relevant.length === 0) {
    return [];
  }

  return [
    {
      label: formatDayLabel(startOfUTCDay(referenceDate)),
      positioning: clampScore(average(relevant.map((response) => response.metrics.positioning))),
      factual: clampScore(average(relevant.map((response) => response.metrics.factual))),
      sentiment: clampScore(average(relevant.map((response) => response.metrics.sentiment))),
    },
  ];
}

function deriveTrend(
  responses: ParsedResponse[],
  latestRunId: string,
  referenceDate: Date,
): PerceptionViewData["trend"] {
  return buildTrendSeriesByPeriod(responses, referenceDate, latestRunId);
}

function buildAllTrendData(
  responses: ParsedResponse[],
  referenceDate: Date,
): PerceptionTrendPoint[] {
  const datedResponses = responses.filter((response) => response.createdAt !== null);
  if (datedResponses.length === 0) return [];

  const earliest = datedResponses.reduce(
    (min, current) =>
      current.createdAt && current.createdAt.getTime() < min.getTime() ? current.createdAt : min,
    datedResponses[0]!.createdAt!,
  );
  const spanDays = Math.max(1, Math.ceil((referenceDate.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000)));
  return buildPeriodTrendData(datedResponses, referenceDate, spanDays, spanDays > 45 ? "week" : "day");
}

function buildTrendSeriesByPeriod(
  responses: ParsedResponse[],
  referenceDate: Date,
  latestRunId: string,
): PerceptionViewData["trend"] {
  return {
    all: {
      periodLabel: PERCEPTION_PERIOD_LABELS.all,
      data: buildAllTrendData(responses, referenceDate),
    },
    "7d": {
      periodLabel: PERCEPTION_PERIOD_LABELS["7d"],
      data: buildPeriodTrendData(responses, referenceDate, 7, "day"),
    },
    "30d": {
      periodLabel: PERCEPTION_PERIOD_LABELS["30d"],
      data: buildPeriodTrendData(responses, referenceDate, 30, "day"),
    },
    "90d": {
      periodLabel: PERCEPTION_PERIOD_LABELS["90d"],
      data: buildPeriodTrendData(responses, referenceDate, 90, "week"),
    },
    "last-run": {
      periodLabel: PERCEPTION_PERIOD_LABELS["last-run"],
      data: buildLastRunTrendData(responses, latestRunId, referenceDate),
    },
  };
}

function severityFromScore(score: number): PerceptionSeverity {
  if (score < 50) return "high";
  if (score < 75) return "medium";
  return "low";
}

function priorityFromSeverity(severity: PerceptionSeverity): OptimizePriority {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function lowScoringModels(
  heatmap: PerceptionViewData["modelAxisHeatmap"],
  axis: keyof PerceptionHeatmapRow["values"],
): string[] {
  const sorted = [...heatmap.rows]
    .sort((left, right) => (left.values[axis] ?? 0) - (right.values[axis] ?? 0))
    .filter((row) => (row.values[axis] ?? 0) < 75)
    .map((row) => row.model);
  return sorted.length > 0 ? sorted : heatmap.rows.slice(0, 2).map((row) => row.model);
}

function deriveTopErrors(
  payload: PerceptionApiPayload,
  brandCanon: BrandCanon,
  scores: PerceptionScores,
  radar: PerceptionRadarPoint[],
  heatmap: PerceptionViewData["modelAxisHeatmap"],
): PerceptionError[] {
  if (payload.topErrors && payload.topErrors.length > 0) {
    return payload.topErrors.slice(0, 3).map((error, index) => {
      const score = radar[index]?.score ?? 0;
      const severity = (error.severity as PerceptionSeverity) || severityFromScore(score);
      return {
        id: error.id || `perception-error-${index + 1}`,
        type: error.type || `perception-gap-${index + 1}`,
        severity,
        title: error.title || "Ecart de perception detecte",
        issue: error.issue || "Le backend a signale un ecart de perception sur cet axe.",
        impact: error.impact || "Cet ecart degrade la comprehension de la marque par les IA.",
        detectedInModels: error.detectedInModels ?? heatmap.rows.slice(0, 2).map((row) => row.model),
        fixType: (error.fixType as PerceptionError["fixType"]) || "website_copy",
        optimizePriority: (error.optimizePriority as OptimizePriority) || priorityFromSeverity(severity),
        generatedContent:
          error.generatedContent ||
          `Clarifier ${brandCanon.brandName || "la marque"} sur cet axe dans le site et les contenus sources.`,
      };
    });
  }

  const radarByAxis = new Map(radar.map((point) => [point.axis, point.score] as const));
  const brandLabel = brandCanon.brandName || "la marque";

  const candidates: Array<{
    type: string;
    score: number;
    axis: keyof PerceptionHeatmapRow["values"];
    title: string;
    issue: string;
    impact: string;
    fixType: PerceptionError["fixType"];
    generatedContent: string;
  }> = [
    {
      type: "positioning_gap",
      score: scores.positioningAccuracy,
      axis: "positioning",
      title: "Positionnement encore mal cite",
      issue: `${scores.positioningAccuracy}% des reponses citent correctement ${brandLabel}. Une partie des modeles ne rattache pas encore la marque au bon contexte.`,
      impact: "La marque peut etre sous-selectionnee ou apparaitre hors sujet dans les recommandations IA.",
      fixType: "website_copy",
      generatedContent:
        "Renforcer la proposition de valeur et les cas d'usage directement dans les pages d'entree, les titres et les FAQs.",
    },
    {
      type: "citation_gap",
      score: scores.factualAccuracy,
      axis: "features",
      title: "Trop peu de reponses citees",
      issue: `${scores.factualAccuracy}% des reponses contiennent une citation exploitable. Les IA repondent souvent sans appui explicite sur vos pages.`,
      impact: "Le discours est moins verifiable et la factualite de la marque baisse dans les resultats.",
      fixType: "faq_snippet",
      generatedContent:
        "Ajouter des blocs FAQ, preuves, statistiques et pages de reference facilement citables sur les points cles du produit.",
    },
    {
      type: "use_case_gap",
      score: radarByAxis.get("use_cases") ?? 0,
      axis: "use_cases",
      title: "Couverture use cases incomplete",
      issue: `${radarByAxis.get("use_cases") ?? 0}% des prompts couverts aboutissent a une mention claire de ${brandLabel}. Les IA ne rattachent pas encore assez la marque aux scenarios cibles.`,
      impact: "Les opportunites de presence sur les requetes d'intention restent partielles.",
      fixType: "website_copy",
      generatedContent:
        "Rendre les use cases prioritaires plus visibles dans la navigation, les hero sections et les pages de comparaison.",
    },
    {
      type: "sentiment_gap",
      score: scores.sentimentScore,
      axis: "sentiment",
      title: "Sentiment encore trop neutre ou negatif",
      issue: `Le score de sentiment est de ${scores.sentimentScore}/100. Les reponses manquent encore de signaux differenciants ou penchent trop vers des alternatives.`,
      impact: "La marque est moins convaincante dans les syntheses IA et perd en desirabilite.",
      fixType: "prompt_patch",
      generatedContent:
        "Mieux documenter les preuves de valeur, les resultats clients et les differentiants pour orienter les reponses vers des signaux plus positifs.",
    },
    {
      type: "competitive_gap",
      score: radarByAxis.get("competitors") ?? 0,
      axis: "competitors",
      title: "Position concurrentielle encore faible",
      issue: `Le score concurrentiel est de ${radarByAxis.get("competitors") ?? 0}/100. Les IA placent encore trop souvent la marque derriere des concurrents sur les comparatifs.`,
      impact: "Le trafic de consideration peut etre capte par d'autres acteurs sur les requetes de comparaison.",
      fixType: "schema_update",
      generatedContent:
        "Ajouter des comparatifs, tableaux de differenciation et contenus de preuve sur les concurrents reels du projet.",
    },
  ];

  return candidates
    .filter((candidate) => candidate.score < 90)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((candidate, index) => {
      const severity = severityFromScore(candidate.score);
      return {
        id: candidate.type,
        type: candidate.type,
        severity,
        title: candidate.title,
        issue: candidate.issue,
        impact: candidate.impact,
        detectedInModels: lowScoringModels(heatmap, candidate.axis),
        fixType: candidate.fixType,
        optimizePriority: priorityFromSeverity(severity),
        generatedContent: candidate.generatedContent,
      };
    });
}

function deriveTopErrorsFromMetrics(
  brandCanon: BrandCanon,
  scores: PerceptionScores,
  radar: PerceptionRadarPoint[],
  heatmap: PerceptionViewData["modelAxisHeatmap"],
): PerceptionError[] {
  return deriveTopErrors({}, brandCanon, scores, radar, heatmap);
}

function serializeResponses(responses: ParsedResponse[]): PerceptionResponseRecord[] {
  return responses.map((response) => ({
    ...response,
    createdAt: response.createdAt?.toISOString() ?? null,
  }));
}

function parseResponseRecord(record: PerceptionResponseRecord): ParsedResponse {
  return {
    ...record,
    createdAt: record.createdAt ? parseISODate(record.createdAt) : null,
  };
}

export function filterPerceptionResponses(
  responses: PerceptionResponseRecord[],
  {
    selectedModels,
    period,
    referenceDate,
    latestRunId,
  }: {
    selectedModels?: string[];
    period: PerceptionTrendPeriodKey;
    referenceDate: string;
    latestRunId?: string;
  },
): PerceptionResponseRecord[] {
  const modelSet = new Set((selectedModels ?? []).filter(Boolean));
  const reference = parseISODate(referenceDate) ?? new Date();

  return responses.filter((response) => {
    if (modelSet.size > 0) {
      const matchesModel = [
        response.modelId,
        response.modelName,
        response.modelGroupName,
      ]
        .filter(Boolean)
        .some((value) => modelSet.has(value));

      if (!matchesModel) {
        return false;
      }
    }

    if (period === "all") return true;
    if (period === "last-run") {
      return latestRunId ? response.runId === latestRunId : true;
    }

    if (!response.createdAt) return false;
    const createdAt = parseISODate(response.createdAt);
    if (!createdAt) return false;
    const minDate = addDays(startOfUTCDay(reference), -(daysForPeriod(period) - 1));
    return createdAt.getTime() >= minDate.getTime();
  });
}

export function derivePerceptionScoresFromResponses(
  responses: PerceptionResponseRecord[],
): PerceptionScores {
  return deriveScoresFromParsedResponses(responses.map(parseResponseRecord));
}

export function derivePerceptionRadarFromResponses(
  responses: PerceptionResponseRecord[],
): PerceptionRadarPoint[] {
  if (responses.length === 0) return [];
  return deriveRadarFromParsedResponses(responses.map(parseResponseRecord));
}

export function derivePerceptionHeatmapFromResponses(
  responses: PerceptionResponseRecord[],
  {
    groupByModelFamily = true,
  }: {
    groupByModelFamily?: boolean;
  } = {},
): PerceptionViewData["modelAxisHeatmap"] {
  return deriveModelAxisHeatmapFromParsedResponses(
    responses.map(parseResponseRecord),
    { groupByModelFamily },
  );
}

export function derivePerceptionTopErrorsFromResponses(
  brandCanon: BrandCanon,
  responses: PerceptionResponseRecord[],
): PerceptionError[] {
  if (responses.length === 0) return [];
  const parsedResponses = responses.map(parseResponseRecord);
  const scores = deriveScoresFromParsedResponses(parsedResponses);
  const radar = deriveRadarFromParsedResponses(parsedResponses);
  const heatmap = deriveModelAxisHeatmapFromParsedResponses(parsedResponses);
  return deriveTopErrorsFromMetrics(brandCanon, scores, radar, heatmap);
}

export function derivePerceptionTrendSeries(
  responses: PerceptionResponseRecord[],
  {
    period,
    referenceDate,
    latestRunId,
  }: {
    period: PerceptionTrendPeriodKey;
    referenceDate: string;
    latestRunId?: string;
  },
): PerceptionTrendSeries {
  const reference = parseISODate(referenceDate) ?? new Date();
  const allSeries = buildTrendSeriesByPeriod(responses.map(parseResponseRecord), reference, latestRunId ?? "");
  return allSeries[period] ?? allSeries["30d"];
}

function buildPerceptionBase(
  projectPayload: unknown,
  competitorsPayload: unknown,
  monitoringPayload: unknown,
  perceptionPayload: PerceptionApiPayload,
  modelLookup: Map<string, PerceptionModelOption>,
  modelCatalog: PerceptionModelOption[],
  runtimeMode: RuntimeMode,
  projectId: string,
): PerceptionViewData {
  const projectModelFilter = parseProjectModelFilter(perceptionPayload.metadata?.projectModels);
  const responses = filterResponsesToProjectModels(parseResponses(monitoringPayload, modelLookup), projectModelFilter);
  const monitoringLatestRunId = asString(
    getField(asObject(getField(asObject(monitoringPayload), ["latestRun", "LatestRun"])), ["id", "ID"]),
  );
  const latestRunId = deriveLatestRunIdFromResponses(responses, monitoringLatestRunId);
  const generatedAtValue = asString(perceptionPayload.metadata?.generatedAt);
  const generatedAt = parseISODate(generatedAtValue);
  const referenceDate =
    generatedAt ||
    responses
      .map((response) => response.createdAt)
      .filter((value): value is Date => value !== null)
      .sort((left, right) => right.getTime() - left.getTime())[0] ||
    new Date();

  const brandCanon = deriveBrandCanon(projectPayload);
  const competitors = parseCompetitors(competitorsPayload);
  const scores = deriveScores(perceptionPayload, responses);
  const radar = deriveRadar(perceptionPayload, responses);
  const activeModelCatalog = projectModelFilter.size > 0
    ? modelCatalog.filter((model) => projectModelFilter.has(model.id))
    : modelCatalog.filter((model) => model.live);
  const visibleModelCatalog = activeModelCatalog.length > 0 ? activeModelCatalog : modelCatalog;
  const modelAxisHeatmap = deriveModelAxisHeatmap(responses, visibleModelCatalog);
  const trend = deriveTrend(responses, latestRunId, referenceDate);
  const topErrors = deriveTopErrors(perceptionPayload, brandCanon, scores, radar, modelAxisHeatmap);
  const models = uniqueStrings(
    responses.map((response) => response.modelName || response.modelId).filter(Boolean),
  );

  return {
    source: "project",
    brandCanon,
    competitors,
    radar,
    scores,
    topErrors,
    modelAxisHeatmap,
    trend,
    responses: serializeResponses(responses),
    metadata: {
      ...perceptionPayload.metadata,
      runtimeMode,
      projectId,
      windowLabel: deriveWindowLabel(responses, referenceDate),
      analyzedResponses: responses.length,
      models,
      modelCatalog: visibleModelCatalog,
      latestRunId,
      generatedAt: (generatedAt || referenceDate).toISOString(),
    },
  };
}

function mergePerceptionData(
  base: PerceptionViewData,
  payload: PerceptionApiPayload,
  runtimeMode: RuntimeMode,
  projectId: string,
): PerceptionViewData {
  const incomingBrandCanon = payload.brandCanon ?? {};

  const radar = base.radar.map((point) => {
    const incoming = payload.radar?.find((entry) => entry.axis === point.axis);
    return {
      ...point,
      score: clampScore(asNumber(incoming?.score ?? point.score)),
      target: clampScore(asNumber(incoming?.target ?? point.target)),
      label: incoming?.label || point.label,
    };
  });

  const brandCanon: BrandCanon = {
    ...base.brandCanon,
    ...incomingBrandCanon,
    audience: Array.isArray(incomingBrandCanon.audience) ? incomingBrandCanon.audience.filter(Boolean) : base.brandCanon.audience,
    useCases: Array.isArray(incomingBrandCanon.useCases) ? incomingBrandCanon.useCases.filter(Boolean) : base.brandCanon.useCases,
    features: Array.isArray(incomingBrandCanon.features) ? incomingBrandCanon.features.filter(Boolean) : base.brandCanon.features,
    pricing: {
      ...base.brandCanon.pricing,
      ...(incomingBrandCanon.pricing ?? {}),
    },
  };

  return {
    ...base,
    source: "project",
    brandCanon,
    competitors: base.competitors,
    radar,
    scores: {
      positioningAccuracy: clampScore(asNumber(payload.scores?.positioningAccuracy ?? base.scores.positioningAccuracy)),
      factualAccuracy: clampScore(asNumber(payload.scores?.factualAccuracy ?? base.scores.factualAccuracy)),
      sentimentScore: clampScore(asNumber(payload.scores?.sentimentScore ?? base.scores.sentimentScore)),
    },
    topErrors: base.topErrors,
    responses: base.responses,
    metadata: {
      ...base.metadata,
      ...payload.metadata,
      runtimeMode,
      projectId,
      models: base.metadata.models,
      modelCatalog: base.metadata.modelCatalog,
      analyzedResponses: asNumber(payload.metadata?.analyzedResponses ?? base.metadata.analyzedResponses),
      windowLabel: payload.metadata?.windowLabel || base.metadata.windowLabel,
      latestRunId: base.metadata.latestRunId,
      generatedAt: payload.metadata?.generatedAt || base.metadata.generatedAt,
    },
  };
}

export async function loadPerceptionData(
  apiBaseURL: string,
  routeSearch: string,
  options?: { signal?: AbortSignal },
): Promise<PerceptionLoadResult> {
  const mode = resolveRuntimeMode(routeSearch);
  let projectId = readProjectIdFromSearch(routeSearch);

  if (apiBaseURL.trim() === "") {
    throw new PerceptionRequestError(0, "api base url is empty");
  }

  if (!projectId) {
    const projectsPayload = unwrapRequiredEnvelope(
      await gatewayJSON<unknown>(apiBaseURL, "/projects", {
        method: "GET",
        signal: options?.signal,
      }),
      "projects",
    );
    const projects = asArray(projectsPayload).map(asObject);
    const first = projects[0];
    if (first) {
      projectId = asString(getField(first, ["id", "ID"])) || null;
    }
  }

  if (!projectId) {
    throw new PerceptionRequestError(404, "no project available");
  }

  const encodedProjectId = encodeProjectPathSegment(projectId);

  const [projectRes, modelsRes, competitorsRes, monitoringRes, perceptionRes] = await Promise.all([
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.get(encodedProjectId), {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.models(encodedProjectId), {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.competitors(encodedProjectId), {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.monitoring(encodedProjectId), {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.perception(encodedProjectId), {
      method: "GET",
      signal: options?.signal,
    }),
  ]);

  const projectPayload = unwrapRequiredEnvelope(projectRes, "project");
  const modelsPayload = unwrapRequiredEnvelope(modelsRes, "models");
  const competitorsPayload = unwrapRequiredEnvelope(competitorsRes, "competitors");
  const monitoringPayload = unwrapRequiredEnvelope(monitoringRes, "monitoring");
  const perceptionPayload = asObject(unwrapRequiredEnvelope(perceptionRes, "perception")) as PerceptionApiPayload;

  const modelCatalog = normalizeModelPayloadList(modelsPayload).map((model) =>
    toProjectModelMeta(model),
  );
  const modelLookup = buildProjectModelLookup(modelCatalog);
  const base = buildPerceptionBase(projectPayload, competitorsPayload, monitoringPayload, perceptionPayload, modelLookup, modelCatalog, mode, projectId);

  return {
    data: mergePerceptionData(base, perceptionPayload, mode, projectId),
    projectId,
    mode,
  };
}
