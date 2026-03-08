"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/dashboard/date-range-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DateRange } from "react-day-picker";
import { API_CONFIG, buildApiPath, apiRoutes } from "@/lib/api-config";
import {
  getModelIconForName,
  PERCEPTION_HEATMAP_AXIS_COLORS,
  PERCEPTION_PERIOD_LABELS,
  PERCEPTION_TEXT,
  PERCEPTION_VISIBLE_AXES,
} from "@/lib/app-data";
import { cn } from "@/lib/utils";
import type { BrandCanon, OptimizePriority, PerceptionError, PerceptionViewData } from "@/lib/perception-data";
import { DashboardSectionTitle } from "@/features/monitoring/_components/dashboard-section-title";
import { PerceptionThreeColumnLayout } from "./_components/perception-three-column-layout";
import { PerceptionDonutVisual } from "./_components/perception-donut-visual";
import { PerceptionLeftPanel } from "./_components/perception-left-panel";
import { PerceptionModelAxisHeatmap } from "./_components/perception-model-axis-heatmap";
import { PerceptionScoreMiniCard } from "./_components/perception-score-mini-card";
import { PerceptionTrendChart } from "./_components/perception-trend-chart";
import { TopErrorsPanel } from "./_components/top-errors-panel";

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
  const [canonDraft, setCanonDraft] = useState<BrandCanon>(initialData.brandCanon);
  const [optimizeDrafts, setOptimizeDrafts] = useState<OptimizeDraft[]>([]);
  const [savingErrorIds, setSavingErrorIds] = useState<Set<string>>(new Set());
  const [persistError, setPersistError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showAllModels, setShowAllModels] = useState(false);

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

  const scoreCards = useMemo(
    () => [
      {
        id: "positioning",
        title: PERCEPTION_TEXT.scoreCards.positioning.title,
        value: initialData.scores.positioningAccuracy,
        hint: PERCEPTION_TEXT.scoreCards.positioning.hint,
        icon: Target,
      },
      {
        id: "factual",
        title: PERCEPTION_TEXT.scoreCards.factual.title,
        value: initialData.scores.factualAccuracy,
        hint: PERCEPTION_TEXT.scoreCards.factual.hint,
        icon: CheckCircle2,
      },
      {
        id: "sentiment",
        title: PERCEPTION_TEXT.scoreCards.sentiment.title,
        value: initialData.scores.sentimentScore,
        hint: PERCEPTION_TEXT.scoreCards.sentiment.hint,
        icon: Sparkles,
      },
    ],
    [initialData.scores],
  );

  const modelOptions = useMemo(() => Array.from(new Set(initialData.metadata.models)), [initialData.metadata.models]);

  const filteredTopErrors = useMemo(() => {
    if (selectedModels.length === 0) return initialData.topErrors;
    return initialData.topErrors.filter((error) => error.detectedInModels.some((m) => selectedModels.includes(m)));
  }, [initialData.topErrors, selectedModels]);

  const modelAxisHeatmap = useMemo(() => {
    const axisOrder = initialData.radar
      .filter((point) => PERCEPTION_VISIBLE_AXES.includes(point.axis as (typeof PERCEPTION_VISIBLE_AXES)[number]))
      .map((point) => ({
      key: point.axis,
      label: point.label,
      color: PERCEPTION_HEATMAP_AXIS_COLORS[point.axis] ?? "hsl(var(--primary))",
    }));

    const visibleModels = selectedModels.length > 0 ? selectedModels : initialData.metadata.models;
    const baseByAxis = new Map(initialData.radar.map((point) => [point.axis, point.score] as const));
    const penaltyByErrorType: Record<string, Array<{ axis: string; delta: number }>> = {
      wrong_category: [{ axis: "positioning", delta: 20 }, { axis: "competitors", delta: 8 }],
      missing_feature: [{ axis: "features", delta: 18 }, { axis: "use_cases", delta: 8 }],
      competitor_misattribution: [{ axis: "competitors", delta: 20 }, { axis: "positioning", delta: 6 }],
    };

    const hash = (value: string) =>
      value.split("").reduce((acc, char, idx) => (acc + char.charCodeAt(0) * (idx + 1)) % 997, 0);
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

    const rows = visibleModels.map((model) => {
      const values: Record<string, number> = {};
      const noiseSeed = hash(model);
      for (const axis of axisOrder) {
        const base = baseByAxis.get(axis.key as PerceptionViewData["radar"][number]["axis"]) ?? 60;
        const modelBias = ((noiseSeed + hash(axis.key)) % 11) - 5;
        values[axis.key] = clamp(base + modelBias);
      }

      for (const error of initialData.topErrors) {
        if (!error.detectedInModels.includes(model)) continue;
        for (const penalty of penaltyByErrorType[error.type] ?? []) {
          values[penalty.axis] = clamp((values[penalty.axis] ?? 0) - penalty.delta);
        }
      }

      return { model, values };
    });

    return { axes: axisOrder, rows };
  }, [initialData.metadata.models, initialData.radar, initialData.topErrors, selectedModels]);

  const perceptionTrend = useMemo(() => {
    const period = selectedPeriod === "last-run" ? "30d" : selectedPeriod;
    const pointsCount = period === "7d" ? 7 : period === "90d" ? 12 : 10;
    const labels =
      period === "7d"
        ? ["J-6", "J-5", "J-4", "J-3", "J-2", "J-1", "Aujourd'hui"]
        : period === "90d"
          ? ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"]
          : ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"];

    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const makeSeries = (target: number, waveA: number, waveB: number, phase = 0) =>
      Array.from({ length: pointsCount }, (_, i) => {
        const t = i / Math.max(pointsCount - 1, 1);
        const baselineStart = Math.max(15, target - 12);
        const trend = baselineStart + (target - baselineStart) * t;
        const wobble = Math.sin((i + phase) * 0.9) * waveA + Math.cos((i + phase) * 0.45) * waveB;
        return clamp(trend + wobble);
      });

    const positioning = makeSeries(initialData.scores.positioningAccuracy, 3.5, 1.8, 1);
    const factual = makeSeries(initialData.scores.factualAccuracy, 4.2, 2.4, 3);
    const sentiment = makeSeries(initialData.scores.sentimentScore, 2.8, 1.5, 2);

    const data = Array.from({ length: pointsCount }, (_, i) => ({
      label: labels[i] ?? `${i + 1}`,
      positioning: positioning[i],
      factual: factual[i],
      sentiment: sentiment[i],
    }));

    return {
      periodLabel: periodLabel(selectedPeriod, initialData.metadata.windowLabel),
      data,
    };
  }, [initialData.metadata.windowLabel, initialData.scores, selectedPeriod]);

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
          windowLabel={periodLabel(selectedPeriod, initialData.metadata.windowLabel)}
          analyzedResponses={initialData.metadata.analyzedResponses}
          selectedModels={selectedModels}
          isDemo={!initialData.metadata.projectId}
        />
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Card className="border-border/60 overflow-hidden py-4">
            <CardContent className="p-0">
              <PerceptionDonutVisual points={initialData.radar} />
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
                        {draft.priority}
                      </Badge>
                    </div>
                    <div className="mb-2 text-xs text-muted-foreground">
                      {draft.type} • {PERCEPTION_TEXT.optimizeActions.statusPrefix}: {draft.status}
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

function PerceptionFiltersCard({
  selectedModels,
  selectedPeriod,
  onModelToggle,
  onResetModels,
  onPeriodChange,
  dateRange,
  onDateRangeChange,
  modelOptions,
  showAllModels,
  onToggleShowAllModels,
}: {
  selectedModels: string[];
  selectedPeriod: string;
  onModelToggle: (value: string) => void;
  onResetModels: () => void;
  onPeriodChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (value: DateRange | undefined) => void;
  modelOptions: string[];
  showAllModels: boolean;
  onToggleShowAllModels: () => void;
}) {
  const MODELS_COUNT = 4;
  const visibleModels = showAllModels ? modelOptions : modelOptions.slice(0, MODELS_COUNT);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0">
          <DashboardSectionTitle>{PERCEPTION_TEXT.filters.title}</DashboardSectionTitle>
        </h4>
      </div>
      <div className="space-y-1.5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-muted-foreground">{PERCEPTION_TEXT.filters.models}</label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 px-2 text-[10px]", selectedModels.length === 0 && "text-primary")}
                onClick={onResetModels}
              >
                {PERCEPTION_TEXT.filters.all}
              </Button>
              {selectedModels.length > 0 ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onResetModels}>
                  {PERCEPTION_TEXT.filters.clear}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleModels.map((model) => (
              <ModelCard
                key={model}
                name={model}
                icon={getModelIconForName(model)}
                selected={selectedModels.includes(model)}
                onClick={() => onModelToggle(model)}
              />
            ))}
          </div>
          {modelOptions.length > MODELS_COUNT ? (
            <Button
              variant="ghost"
              className="mt-1 h-auto min-h-7 w-full whitespace-normal py-1 text-xs leading-tight text-muted-foreground hover:text-foreground"
              onClick={onToggleShowAllModels}
            >
              {showAllModels ? (
                <>
                  {PERCEPTION_TEXT.filters.showLess} <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  {PERCEPTION_TEXT.filters.showMore} ({modelOptions.length - MODELS_COUNT}) <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{PERCEPTION_TEXT.filters.period}</label>
          <DatePickerWithRange
            date={dateRange}
            setDate={onDateRangeChange}
            period={selectedPeriod === "last-run" ? "30d" : selectedPeriod}
            setPeriod={onPeriodChange}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-muted-foreground">{PERCEPTION_TEXT.filters.businessOption}</div>
            <Select value={selectedPeriod} onValueChange={onPeriodChange}>
              <SelectTrigger className="h-7 w-[150px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{PERCEPTION_PERIOD_LABELS["7d"]}</SelectItem>
                <SelectItem value="30d">{PERCEPTION_PERIOD_LABELS["30d"]}</SelectItem>
                <SelectItem value="90d">{PERCEPTION_PERIOD_LABELS["90d"]}</SelectItem>
                <SelectItem value="last-run">{PERCEPTION_PERIOD_LABELS["last-run"]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

function periodLabel(value: string, fallback: string): string {
  if (value in PERCEPTION_PERIOD_LABELS) {
    return PERCEPTION_PERIOD_LABELS[value as keyof typeof PERCEPTION_PERIOD_LABELS];
  }
  return fallback;
}

function ModelCard({
  name,
  icon,
  selected,
  onClick,
}: {
  name: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
        selected ? "border-primary bg-primary/5 text-foreground" : "border-border/60 bg-background hover:bg-muted/40",
      )}
    >
      <img src={icon} alt="" className="h-4 w-4 shrink-0" aria-hidden="true" decoding="async" />
      <span className="min-w-0 truncate text-xs font-medium">{name}</span>
    </button>
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
