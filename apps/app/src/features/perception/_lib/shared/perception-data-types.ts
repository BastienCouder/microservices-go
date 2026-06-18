import {
  getPerceptionPeriodLabel,
} from "@/lib/app-data";
import type { ProjectModelMeta } from "@/lib/project-models";
import type { RuntimeMode } from "@/lib/runtime-mode";
import { resolveRuntimeMode } from "@/lib/runtime-mode";

export type PerceptionAxisKey =
  | "positioning"
  | "pricing"
  | "use_cases"
  | "features"
  | "sentiment"
  | "competitors";

export type PerceptionSeverity = "high" | "medium" | "low";
export type OptimizePriority = "high" | "medium" | "low";
export type PerceptionTrendPeriodKey = "all" | "7d" | "30d" | "90d" | "last-run";
export type PerceptionSourceFilter = "perception" | "monitoring" | "all";

export type BrandCanon = {
  brandName: string;
  shortDescription: string;
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
  titleKey?: string;
  issue: string;
  issueKey?: string;
  impact: string;
  impactKey?: string;
  detectedInModels: string[];
  fixType: "prompt_patch" | "website_copy" | "schema_update" | "faq_snippet";
  generatedContent: string;
  generatedContentKey?: string;
  translationParams?: Record<string, unknown>;
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
  runType: string;
  promptKind?: string;
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
    perceptionResponses?: number;
    monitoringResponsesUsed?: number;
    sourceMode?: string;
    visibilityScore?: number;
    models: string[];
    projectModels?: string[];
    primaryLanguage?: "fr" | "en";
    modelCatalog: PerceptionModelOption[];
    generatedAt: string;
    latestRunId?: string;
    emptyStateLabel?: string;
    runtimeMode: RuntimeMode;
  };
};

export type PerceptionApiPayload = {
  brandCanon?: Partial<BrandCanon> & {
    pricing?: Partial<BrandCanon["pricing"]>;
  };
  scores?: Partial<PerceptionScores>;
  radar?: Array<Partial<PerceptionRadarPoint>>;
  topErrors?: Array<Partial<PerceptionError>>;
  responses?: unknown;
  metadata?: Partial<PerceptionViewData["metadata"]> & {
    projectModels?: unknown;
  };
};

export type PerceptionApiPayloadWithDashboard = PerceptionApiPayload & {
  dashboard?: unknown;
  Dashboard?: unknown;
  monitoring?: unknown;
  Monitoring?: unknown;
};

const EMPTY_BRAND_CANON: BrandCanon = {
  brandName: "",
  shortDescription: "",
  category: "",
  positioning: "",
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

export function createEmptyPerceptionViewData(
  routeSearch = "",
  emptyStateLabel?: string | null,
): PerceptionViewData {
  const generatedAt = new Date().toISOString();
  const normalizedEmptyStateLabel = emptyStateLabel?.trim() || undefined;

  return {
    source: "fallback",
    brandCanon: {
      ...EMPTY_BRAND_CANON,
      audience: [],
      useCases: [],
      pricing: { ...EMPTY_BRAND_CANON.pricing },
      features: [],
    },
    competitors: [],
    radar: [],
    scores: {
      positioningAccuracy: 0,
      factualAccuracy: 0,
      sentimentScore: 0,
    },
    topErrors: [],
    modelAxisHeatmap: {
      axes: [],
      rows: [],
    },
    trend: {
      all: {
        periodLabel: getPerceptionPeriodLabel("all"),
        data: [],
      },
      "7d": {
        periodLabel: getPerceptionPeriodLabel("7d"),
        data: [],
      },
      "30d": {
        periodLabel: getPerceptionPeriodLabel("30d"),
        data: [],
      },
      "90d": {
        periodLabel: getPerceptionPeriodLabel("90d"),
        data: [],
      },
      "last-run": {
        periodLabel: getPerceptionPeriodLabel("last-run"),
        data: [],
      },
    },
    responses: [],
    metadata: {
      projectId: null,
      windowLabel: "",
      analyzedResponses: 0,
      models: [],
      projectModels: [],
      primaryLanguage: "fr",
      modelCatalog: [],
      generatedAt,
      emptyStateLabel: normalizedEmptyStateLabel,
      runtimeMode: resolveRuntimeMode(routeSearch),
    },
  };
}

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
