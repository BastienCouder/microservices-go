import { apiRoutes } from "@/lib/api-config";
import { PERCEPTION_AXIS_LABELS } from "@/lib/app-data";
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

export type PerceptionViewData = {
  source: "project" | "fallback" | "demo";
  brandCanon: BrandCanon;
  radar: PerceptionRadarPoint[];
  scores: PerceptionScores;
  topErrors: PerceptionError[];
  metadata: {
    brandId?: string;
    projectId?: string | null;
    windowLabel: string;
    analyzedResponses: number;
    models: string[];
    generatedAt: string;
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

const PERCEPTION_BASELINE_DATA: PerceptionViewData = {
  source: "project",
  brandCanon: {
    brandName: "Nike",
    category: "Marque de sport / apparel & footwear",
    positioning:
      "Marque mondiale de performance et lifestyle sportif, centrée sur l'innovation produit, l'inspiration et la distribution omnicanale.",
    audience: ["Athlètes", "Sportifs amateurs", "Sneakerheads", "Consommateurs lifestyle"],
    useCases: ["Running performance", "Training", "Basketball", "Lifestyle sneakers"],
    pricing: {
      amount: 120,
      currency: "EUR",
      period: "item",
      note: "Prix moyen indicatif selon les gammes",
    },
    features: [
      "Chaussures performance",
      "Apparel technique",
      "Innovation cushioning",
      "Personnalisation",
      "Nike Run Club / Training Club",
      "Distribution DTC + retail",
    ],
  },
  radar: [
    { axis: "positioning", label: PERCEPTION_AXIS_LABELS.positioning, score: 82, target: 100 },
    { axis: "use_cases", label: PERCEPTION_AXIS_LABELS.use_cases, score: 74, target: 100 },
    { axis: "features", label: PERCEPTION_AXIS_LABELS.features, score: 63, target: 100 },
    { axis: "sentiment", label: PERCEPTION_AXIS_LABELS.sentiment, score: 71, target: 100 },
    { axis: "competitors", label: PERCEPTION_AXIS_LABELS.competitors, score: 66, target: 100 },
  ],
  scores: {
    positioningAccuracy: 78,
    factualAccuracy: 61,
    sentimentScore: 73,
  },
  topErrors: [
    {
      id: "err-pricing-01",
      severity: "high",
      type: "pricing_gap",
      title: "Pricing halluciné: “trop cher”",
      issue:
        "Certaines IA présentent Nike comme une marque 'ultra premium' avec des prix systématiquement >250€, alors que beaucoup de références sont en dessous.",
      impact: "Dégrade la factual accuracy et biaise la perception d'accessibilité de la gamme.",
      detectedInModels: ["ChatGPT", "Gemini"],
      fixType: "faq_snippet",
      optimizePriority: "high",
      generatedContent:
        "FAQ pricing: Nike couvre plusieurs gammes de prix selon la discipline, la technologie et la collection (entrée, milieu, premium). Ajouter des exemples de produits par tranche.",
    },
    {
      id: "err-category-01",
      severity: "high",
      type: "wrong_category",
      title: "Mauvaise catégorie: réduit à “fashion brand”",
      issue:
        "Perplexity et Claude classent parfois Nike uniquement comme marque mode au lieu de marque sport/performance + lifestyle.",
      impact: "Dégrade la Positioning Accuracy et la comparaison concurrentielle (Adidas, Asics, New Balance, etc.).",
      detectedInModels: ["Perplexity", "Claude"],
      fixType: "website_copy",
      optimizePriority: "high",
      generatedContent:
        "Brand copy patch: 'Nike is a sports performance brand spanning footwear, apparel, and training ecosystems — with lifestyle collections as an extension.'",
    },
    {
      id: "err-feature-01",
      severity: "medium",
      type: "missing_feature",
      title: "Feature oubliée: apps NRC / NTC",
      issue:
        "Mistral et Claude mentionnent les chaussures et le style, mais oublient les apps Nike Run Club / Nike Training Club dans plusieurs réponses.",
      impact: "Réduit la couverture des use cases et le score Features (écosystème de marque sous-estimé).",
      detectedInModels: ["Mistral", "Claude"],
      fixType: "schema_update",
      optimizePriority: "medium",
      generatedContent:
        "Ajouter FAQ/feature schema sur l'écosystème digital: coaching, plans d'entraînement, running tracking, intégration expérience produit + app.",
    },
  ],
  metadata: {
    projectId: null,
    brandId: "demo-nike",
    windowLabel: "30 derniers jours",
    analyzedResponses: 148,
    models: ["ChatGPT", "Perplexity", "Claude", "Gemini", "Mistral"],
    generatedAt: new Date("2026-02-23T10:00:00.000Z").toISOString(),
    runtimeMode: "demo",
  },
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

function clampScore(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readProjectIdFromSearch(routeSearch: string): string | null {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  const value =
    params.get("projectId") || params.get("project_id") || params.get("project") || "";
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function mergePerceptionData(
  base: PerceptionViewData,
  payload: PerceptionApiPayload,
  runtimeMode: RuntimeMode,
  projectId: string | null,
): PerceptionViewData {
  const mergedRadar = base.radar.map((point) => {
    const incoming = payload.radar?.find((entry) => entry.axis === point.axis);
    return {
      ...point,
      score: clampScore(incoming?.score, point.score),
      target: clampScore(incoming?.target, point.target),
      label: incoming?.label || point.label,
    };
  });

  const brandCanon = {
    ...base.brandCanon,
    ...payload.brandCanon,
    audience: payload.brandCanon?.audience ?? base.brandCanon.audience,
    useCases: payload.brandCanon?.useCases ?? base.brandCanon.useCases,
    features: payload.brandCanon?.features ?? base.brandCanon.features,
    pricing: {
      ...base.brandCanon.pricing,
      ...(payload.brandCanon?.pricing ?? {}),
    },
  };

  const topErrors = (payload.topErrors?.length ? payload.topErrors : base.topErrors)
    .slice(0, 3)
    .map((err, index) => {
      const fallback = base.topErrors[index] ?? base.topErrors[0];
      return {
        ...fallback,
        ...err,
        id: err.id || fallback.id || `error-${index + 1}`,
        type: err.type || fallback.type,
        severity: (err.severity as PerceptionSeverity) || fallback.severity,
        optimizePriority: (err.optimizePriority as OptimizePriority) || fallback.optimizePriority,
        detectedInModels: err.detectedInModels ?? fallback.detectedInModels,
        generatedContent: err.generatedContent || fallback.generatedContent,
        fixType: (err.fixType as PerceptionError["fixType"]) || fallback.fixType,
      };
    });

  return {
    source: "project",
    brandCanon,
    radar: mergedRadar,
    scores: {
      positioningAccuracy: clampScore(payload.scores?.positioningAccuracy, base.scores.positioningAccuracy),
      factualAccuracy: clampScore(payload.scores?.factualAccuracy, base.scores.factualAccuracy),
      sentimentScore: clampScore(payload.scores?.sentimentScore, base.scores.sentimentScore),
    },
    topErrors,
    metadata: {
      ...base.metadata,
      ...payload.metadata,
      runtimeMode,
      projectId,
      generatedAt: payload.metadata?.generatedAt || new Date().toISOString(),
      models: payload.metadata?.models ?? base.metadata.models,
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

  const projectsResponse = await gatewayJSON<unknown>(apiBaseURL, "/projects", {
    method: "GET",
    signal: options?.signal,
  });
  if (!projectsResponse.ok) {
    throw new PerceptionRequestError(projectsResponse.status, projectsResponse.error);
  }

  const projects = asArray(unwrapSuccessEnvelope(projectsResponse.data)).map(asObject);
  if (!projectId) {
    const first = projects[0];
    if (first) {
      projectId = asString(getField(first, ["id", "ID"])) || null;
    }
  }

  if (!projectId) {
    throw new PerceptionRequestError(404, "no project available");
  }

  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.perception(projectId), {
    method: "GET",
    signal: options?.signal,
  });
  if (!response.ok) {
    throw new PerceptionRequestError(response.status, response.error);
  }

  const payload = asObject(unwrapSuccessEnvelope(response.data)) as PerceptionApiPayload;
  return {
    data: mergePerceptionData(PERCEPTION_BASELINE_DATA, payload, mode, projectId),
    projectId,
    mode,
  };
}
