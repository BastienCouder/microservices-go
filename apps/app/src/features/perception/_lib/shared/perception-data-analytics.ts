import {
  PERCEPTION_AXIS_LABELS,
  PERCEPTION_HEATMAP_AXIS_COLORS,
  PERCEPTION_PERIOD_LABELS,
  PERCEPTION_VISIBLE_AXES,
} from "@/lib/app-data";
import type {
  BrandCanon,
  BrandCompetitor,
  OptimizePriority,
  PerceptionApiPayload,
  PerceptionError,
  PerceptionHeatmapAxis,
  PerceptionHeatmapRow,
  PerceptionModelOption,
  PerceptionRadarPoint,
  PerceptionResponseRecord,
  PerceptionScores,
  PerceptionSeverity,
  PerceptionTrendPeriodKey,
  PerceptionTrendPoint,
  PerceptionTrendSeries,
  PerceptionViewData,
} from "./perception-data-types";

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

type TrendAccumulator = {
  positioning: number;
  factual: number;
  sentiment: number;
  count: number;
};

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

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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
    .sort((left, right) => left[0] - right[0])
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

function deriveTrend(
  responses: ParsedResponse[],
  latestRunId: string,
  referenceDate: Date,
): PerceptionViewData["trend"] {
  return buildTrendSeriesByPeriod(responses, referenceDate, latestRunId);
}

function normalizePerceptionSeverity(value: unknown): PerceptionSeverity {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function normalizeOptimizePriority(value: unknown, severity: PerceptionSeverity): OptimizePriority {
  if (value === "high" || value === "medium" || value === "low") return value;
  return severity;
}

function normalizeFixType(value: unknown): PerceptionError["fixType"] {
  if (
    value === "prompt_patch" ||
    value === "website_copy" ||
    value === "schema_update" ||
    value === "faq_snippet"
  ) {
    return value;
  }
  return "website_copy";
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : [];
}

function normalizeBackendTopErrors(payload: PerceptionApiPayload): PerceptionError[] {
  return (payload.topErrors ?? []).map((error, index) => {
    const severity = normalizePerceptionSeverity(error.severity);
    return {
      id: error.id || `backend-perception-error-${index + 1}`,
      type: error.type || error.id || `backend-perception-error-${index + 1}`,
      severity,
      title: error.title || "",
      issue: error.issue || "",
      impact: error.impact || "",
      detectedInModels: normalizeStringList(error.detectedInModels),
      fixType: normalizeFixType(error.fixType),
      optimizePriority: normalizeOptimizePriority(error.optimizePriority, severity),
      generatedContent: error.generatedContent || "",
      generatedContentKey: error.generatedContentKey || undefined,
    };
  });
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

export function buildPerceptionDerivedData({
  projectPayload,
  competitorsPayload,
  monitoringPayload,
  perceptionPayload,
  modelLookup,
  modelCatalog,
}: {
  projectPayload: unknown;
  competitorsPayload: unknown;
  monitoringPayload: unknown;
  perceptionPayload: PerceptionApiPayload;
  modelLookup: Map<string, PerceptionModelOption>;
  modelCatalog: PerceptionModelOption[];
}) {
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
  const topErrors = normalizeBackendTopErrors(perceptionPayload);
  const models = uniqueStrings(
    responses.map((response) => response.modelName || response.modelId).filter(Boolean),
  );

  return {
    analyzedResponses: responses.length,
    brandCanon,
    competitors,
    generatedAt: (generatedAt || referenceDate).toISOString(),
    latestRunId,
    modelAxisHeatmap,
    models,
    radar,
    responses: serializeResponses(responses),
    scores,
    topErrors,
    trend,
    visibleModelCatalog,
    windowLabel: deriveWindowLabel(responses, referenceDate),
  };
}
