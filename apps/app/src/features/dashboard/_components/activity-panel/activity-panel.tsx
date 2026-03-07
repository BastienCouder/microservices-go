"use client";

import { useCallback, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import {
  filterDashboardAlerts,
  type DashboardData,
  type DashboardPrompt,
} from "@/lib/dashboard-data";
import { useShallow } from "zustand/react/shallow";
import { ActivityAlerts } from "./activity-alerts";
import { ActivityPromptsStream } from "./activity-prompts-stream";
import { ActivityDetailSheets } from "./activity-detail-sheets";
import { matchesPromptAudienceFilters, normalizeModelId, promptIsInPeriodWithDateRange } from "../analytics-panel/analytics-utils";

const ALERTS_PREVIEW_COUNT = 3;
const PROMPTS_PREVIEW_COUNT = 5;
type DashboardAlert = DashboardData["alerts"][number];

export function ActivityPanel() {
  const { data: dashboardData, loading } = useDashboardData();
  const { alerts, recent_prompts, models } = dashboardData;
  const {
    selectedModels,
    selectedPersonas,
    selectedCompetitors,
    period,
    dateRange,
  } = useDashboardStore(
    useShallow((state) => ({
      selectedModels: state.selectedModels,
      selectedPersonas: state.selectedPersonas,
      selectedCompetitors: state.selectedCompetitors,
      period: state.period,
      dateRange: state.dateRange,
    })),
  );

  const [selectedPrompt, setSelectedPrompt] = useState<DashboardPrompt | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<DashboardAlert | null>(null);

  const getModelData = useCallback((modelName: string, modelFilterKey?: string) => {
    if (modelFilterKey) {
      const exact = models.find((model) => model.id === modelFilterKey);
      if (exact) return exact;
    }
    const modelId = normalizeModelId(modelName);
    return models.find((model) => model.id === modelId);
  }, [models]);

  const filteredPrompts = useMemo(() => {
    return recent_prompts.filter(
      (prompt) =>
        matchesPromptAudienceFilters(
          prompt,
          selectedModels,
          selectedPersonas,
          selectedCompetitors,
        ) && promptIsInPeriodWithDateRange(prompt, period, dateRange),
    );
  }, [
    recent_prompts,
    selectedModels,
    selectedPersonas,
    selectedCompetitors,
    period,
    dateRange,
  ]);

  const filteredAlerts = useMemo(
    () =>
      filterDashboardAlerts(alerts, {
        period,
        dateRange,
        selectedModels,
        selectedPersonas,
        selectedCompetitors,
      }),
    [
      alerts,
      period,
      dateRange,
      selectedModels,
      selectedPersonas,
      selectedCompetitors,
    ],
  );

  const handleSelectAlert = useCallback((alert: DashboardAlert) => setSelectedAlert(alert), []);
  const handleSelectPrompt = useCallback((prompt: DashboardPrompt) => setSelectedPrompt(prompt), []);

  if (loading) {
    return (
      <div className="h-auto lg:h-full lg:overflow-y-auto">
        <div className="flex flex-col gap-6 pb-4">
          <Card className="rounded-md">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle><Skeleton className="h-4 w-36" /></CardTitle>
              <Skeleton className="h-5 w-8 rounded-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[72px] rounded-md" />
              <Skeleton className="h-[72px] rounded-md" />
              <Skeleton className="h-[72px] rounded-md" />
            </CardContent>
          </Card>

          <Card className="rounded-md">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle><Skeleton className="h-4 w-32" /></CardTitle>
              <Skeleton className="h-5 w-8 rounded-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[108px] rounded-md" />
              <Skeleton className="h-[108px] rounded-md" />
              <Skeleton className="h-[108px] rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-auto lg:h-full lg:overflow-y-auto">
        <div className="flex flex-col gap-6 pb-4">
          <ActivityAlerts
            filteredAlerts={filteredAlerts}
            previewCount={ALERTS_PREVIEW_COUNT}
            onSelectAlert={handleSelectAlert}
          />

          <ActivityPromptsStream
            filteredPrompts={filteredPrompts}
            models={models}
            previewCount={PROMPTS_PREVIEW_COUNT}
            onSelectPrompt={handleSelectPrompt}
          />
        </div>
      </div>

      <ActivityDetailSheets
        selectedAlert={selectedAlert}
        setSelectedAlert={setSelectedAlert}
        selectedPrompt={selectedPrompt}
        setSelectedPrompt={setSelectedPrompt}
        getModelData={getModelData}
      />
    </>
  );
}
