"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_CONFIG, buildApiPath, apiRoutes } from "@/lib/api-config";
import {
  formatPerceptionFixTypeLabel,
  formatPerceptionPriorityLabel,
  formatPerceptionStatusLabel,
  getModelGroupForName,
  PERCEPTION_TEXT,
} from "@/lib/app-data";
import {
  derivePerceptionHeatmapFromResponses,
  derivePerceptionRadarFromResponses,
  derivePerceptionScoresFromResponses,
  derivePerceptionTopErrorsFromResponses,
  derivePerceptionTrendSeries,
  filterPerceptionResponses,
  type OptimizePriority,
  type PerceptionError,
  type PerceptionTrendPeriodKey,
  type PerceptionViewData,
} from "@/lib/perception-data";
import { DashboardSectionTitle } from "@/features/monitoring/components/dashboard-section-title";
import { PerceptionThreeColumnLayout } from "../components/perception-three-column-layout";
import { PerceptionDonutVisual } from "../components/perception-donut-visual";
import { PerceptionLeftPanel } from "../components/perception-left-panel";
import { PerceptionModelAxisHeatmap } from "../components/perception-model-axis-heatmap";
import { PerceptionScoreMiniCard } from "../components/perception-score-mini-card";
import { PerceptionTrendChart } from "../components/perception-trend-chart";
import { TopErrorsPanel } from "../components/top-errors-panel";

type PerceptionClientProps = {
  initialData: PerceptionViewData;
};

type OptimizeDraft = {
  id: string;
  persistedId?: string;
  priority: OptimizePriority;
  type: PerceptionError["fixType"];
  title: string;
  issue: string;
  impact: string;
  generatedContent: string;
  status: "draft";
};

type PersistedOptimizeAction = {
  id: string;
  priority: OptimizePriority;
  type: PerceptionError["fixType"] | string;
  title: string;
  issue: string;
  impact?: string | null;
  generatedContent: string;
  status?: string | null;
  sourceErrorId?: string | null;
};

export function PerceptionClient({ initialData }: PerceptionClientProps) {
  const canonDraft = initialData.brandCanon;
  const [optimizeDrafts, setOptimizeDrafts] = useState<OptimizeDraft[]>([]);
  const [savingErrorIds, setSavingErrorIds] = useState<Set<string>>(new Set());
  const [persistError, setPersistError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PerceptionTrendPeriodKey>("all");
  const [showAllModels, setShowAllModels] = useState(false);
  const [showUniqueModelFilters, setShowUniqueModelFilters] = useState(false);

  useEffect(() => {
    const projectId = initialData.metadata.projectId;
    if (!projectId) return;

    let isMounted = true;
    void (async () => {
      try {
        const actions = await getJson<PersistedOptimizeAction[]>(apiRoutes.analysis.optimizeActions(projectId));
        if (!isMounted) return;
        setOptimizeDrafts((current) => {
          const merged = new Map(current.map((draft) => [draft.id, draft] as const));
          for (const action of actions) {
            const uiId = action.sourceErrorId || action.id;
            if (merged.has(uiId)) continue;
            merged.set(uiId, {
              id: uiId,
              persistedId: action.id,
              priority: (action.priority ?? "medium") as OptimizePriority,
              type: (action.type as PerceptionError["fixType"]) ?? "prompt_patch",
              title: action.title,
              issue: action.issue,
              impact: action.impact ?? "",
              generatedContent: action.generatedContent,
              status: "draft",
            });
          }
          return Array.from(merged.values());
        });
      } catch {
        // Non-blocking: perception page remains usable without persisted optimize history.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [initialData.metadata.projectId]);

  const modelScopedResponses = useMemo(
    () =>
      filterPerceptionResponses(initialData.responses, {
        selectedModels,
        period: "all",
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: initialData.metadata.latestRunId,
      }),
    [initialData.metadata.generatedAt, initialData.metadata.latestRunId, initialData.responses, selectedModels],
  );

  const filteredResponses = useMemo(
    () =>
      filterPerceptionResponses(modelScopedResponses, {
        period: selectedPeriod,
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: initialData.metadata.latestRunId,
      }),
    [initialData.metadata.generatedAt, initialData.metadata.latestRunId, modelScopedResponses, selectedPeriod],
  );

  const lastRunScores = useMemo(
    () =>
      derivePerceptionScoresFromResponses(
        filterPerceptionResponses(initialData.responses, {
          period: "last-run",
          referenceDate: initialData.metadata.generatedAt,
          latestRunId: initialData.metadata.latestRunId,
        }),
      ),
    [initialData.metadata.generatedAt, initialData.metadata.latestRunId, initialData.responses],
  );

  const filteredRadar = useMemo(
    () => derivePerceptionRadarFromResponses(filteredResponses),
    [filteredResponses],
  );

  const scoreCards = useMemo(
    () => [
      {
        id: "positioning",
        title: PERCEPTION_TEXT.scoreCards.positioning.title,
        value: lastRunScores.positioningAccuracy,
        hint: PERCEPTION_TEXT.scoreCards.positioning.hint,
        icon: Target,
      },
      {
        id: "factual",
        title: PERCEPTION_TEXT.scoreCards.factual.title,
        value: lastRunScores.factualAccuracy,
        hint: PERCEPTION_TEXT.scoreCards.factual.hint,
        icon: CheckCircle2,
      },
      {
        id: "sentiment",
        title: PERCEPTION_TEXT.scoreCards.sentiment.title,
        value: lastRunScores.sentimentScore,
        hint: PERCEPTION_TEXT.scoreCards.sentiment.hint,
        icon: Sparkles,
      },
    ],
    [lastRunScores],
  );

  const modelOptions = useMemo(() => Array.from(new Set(initialData.metadata.models)), [initialData.metadata.models]);

  const filteredTopErrors = useMemo(
    () => derivePerceptionTopErrorsFromResponses(initialData.brandCanon, filteredResponses),
    [filteredResponses, initialData.brandCanon],
  );

  const modelAxisHeatmap = useMemo(() => {
    return derivePerceptionHeatmapFromResponses(filteredResponses, {
      groupModelName: showUniqueModelFilters ? undefined : getModelGroupForName,
    });
  }, [filteredResponses, showUniqueModelFilters]);

  const perceptionTrend = useMemo(() => {
    return derivePerceptionTrendSeries(modelScopedResponses, {
      period: selectedPeriod,
      referenceDate: initialData.metadata.generatedAt,
      latestRunId: initialData.metadata.latestRunId,
    });
  }, [initialData.metadata.generatedAt, initialData.metadata.latestRunId, modelScopedResponses, selectedPeriod]);

  const toggleModel = (model: string) => {
    setSelectedModels((current) =>
      current.includes(model) ? current.filter((item) => item !== model) : [...current, model],
    );
  };

  const handleFix = async (error: PerceptionError) => {
    setPersistError(null);
    if (savingErrorIds.has(error.id)) return;

    if (initialData.metadata.projectId) {
      setSavingErrorIds((current) => new Set(current).add(error.id));
      try {
        const result = await postJson<{ id: string; status: string }>(
          apiRoutes.analysis.optimizeActions(initialData.metadata.projectId),
          {
            priority: error.optimizePriority,
            type: error.fixType,
            title: error.title,
            issue: error.issue,
            impact: error.impact,
            generatedContent: error.generatedContent,
            status: "draft",
            sourceErrorId: error.id,
            metadata: {
              detectedInModels: error.detectedInModels,
              aiModels: error.detectedInModels,
              promptsCount: 0,
            },
          },
        );

        setOptimizeDrafts((current) => {
          if (current.some((draft) => draft.id === error.id)) return current;
          return [
            {
              id: error.id,
              persistedId: result.id,
              priority: error.optimizePriority,
              type: error.fixType,
              title: error.title,
              issue: error.issue,
              impact: error.impact,
              generatedContent: error.generatedContent,
              status: (result.status === "draft" ? "draft" : "draft"),
            },
            ...current,
          ];
        });
      } catch (err) {
        setPersistError(err instanceof Error ? err.message : PERCEPTION_TEXT.optimizeActions.createActionError);
      } finally {
        setSavingErrorIds((current) => {
          const next = new Set(current);
          next.delete(error.id);
          return next;
        });
      }
      return;
    }

    setOptimizeDrafts((current) => {
      if (current.some((draft) => draft.id === error.id)) return current;
      return [
        {
          id: error.id,
          priority: error.optimizePriority,
          type: error.fixType,
          title: error.title,
          issue: error.issue,
          impact: error.impact,
          generatedContent: error.generatedContent,
          status: "draft",
        },
        ...current,
      ];
    });
  };

  const generatedIds = new Set(optimizeDrafts.map((draft) => draft.id));

  return (
    <PerceptionThreeColumnLayout
      left={
        <PerceptionLeftPanel
          canon={canonDraft}
          source={initialData.source}
          windowLabel={perceptionTrend.periodLabel}
          analyzedResponses={filteredResponses.length}
          selectedModels={selectedModels}
          modelOptions={modelOptions}
          selectedPeriod={selectedPeriod}
          onModelToggle={toggleModel}
          onResetModels={() => setSelectedModels([])}
          onPeriodChange={setSelectedPeriod}
          showAllModels={showAllModels}
          onToggleShowAllModels={() => setShowAllModels((current) => !current)}
          showUniqueModelFilters={showUniqueModelFilters}
          onToggleModelFilterMode={(value) => {
            setShowUniqueModelFilters(value);
            setShowAllModels(false);
          }}
          isDemo={!initialData.metadata.projectId}
        />
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Card className="border-border/60 overflow-hidden py-4">
            <CardContent className="p-0">
              <PerceptionDonutVisual points={filteredRadar} />
            </CardContent>
          </Card>

          <PerceptionModelAxisHeatmap axes={modelAxisHeatmap.axes} rows={modelAxisHeatmap.rows} />

          <PerceptionTrendChart data={perceptionTrend.data} periodLabel={perceptionTrend.periodLabel} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {scoreCards.map((card) => {
              return (
                <PerceptionScoreMiniCard key={card.id} {...card} />
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <DashboardSectionTitle>{PERCEPTION_TEXT.optimizeActions.title}</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>
                {PERCEPTION_TEXT.optimizeActions.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {persistError ? (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700">
                  {persistError}
                </div>
              ) : null}
              {optimizeDrafts.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  {PERCEPTION_TEXT.optimizeActions.empty}
                </div>
              ) : (
                optimizeDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{draft.title}</div>
                      <Badge variant={draft.priority === "high" ? "destructive" : "secondary"}>
                        {formatPerceptionPriorityLabel(draft.priority)}
                      </Badge>
                    </div>
                    <div className="mb-2 text-xs text-muted-foreground">
                      {formatPerceptionFixTypeLabel(draft.type)} • {PERCEPTION_TEXT.optimizeActions.statusPrefix}:{" "}
                      {formatPerceptionStatusLabel(draft.status)}
                    </div>
                    <p className="mb-2 text-sm">{draft.issue}</p>
                    <div className="rounded-md bg-muted/50 p-2 text-sm">{draft.generatedContent}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      }
      right={
        <div className="px-1 pb-4">
          <TopErrorsPanel
            errors={filteredTopErrors}
            generatedIds={generatedIds}
            onFix={handleFix}
            savingErrorIds={savingErrorIds}
            modelNames={initialData.metadata.models}
          />
        </div>
      }
    />
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = API_CONFIG.BASE_URL?.trim();
  const url = base ? `${base}${buildApiPath(path)}` : buildApiPath(path);
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: T; message?: string };
  if (json?.data) return json.data;
  throw new Error(json?.message || "Réponse API invalide");
}

async function getJson<T>(path: string): Promise<T> {
  const base = API_CONFIG.BASE_URL?.trim();
  const url = base ? `${base}${buildApiPath(path)}` : buildApiPath(path);
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: T; message?: string };
  if (json?.data !== undefined) return json.data;
  throw new Error(json?.message || "Réponse API invalide");
}
