"use client";

import { useCallback, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import type { DashboardData, DashboardPrompt } from "@/lib/dashboard-data";
import { useShallow } from "zustand/react/shallow";
import { ActivityAlerts } from "./activity-alerts";
import { ActivityPromptsStream } from "./activity-prompts-stream";
import { ActivityDetailSheets } from "./activity-detail-sheets";
import { matchesPromptAudienceFilters, normalizeModelId, promptIsInPeriodWithDateRange } from "../analytics-panel/analytics-utils";

const ALERTS_PREVIEW_COUNT = 3;
const PROMPTS_PREVIEW_COUNT = 5;
type DashboardAlert = DashboardData["alerts"][number];

export function ActivityPanel() {
  const { data: dashboardData } = useDashboardData();
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

  const filteredAlerts = alerts;

  const handleSelectAlert = useCallback((alert: DashboardAlert) => setSelectedAlert(alert), []);
  const handleSelectPrompt = useCallback((prompt: DashboardPrompt) => setSelectedPrompt(prompt), []);

  return (
    <>
      <ScrollArea className="h-auto xl:h-full">
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
      </ScrollArea>

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
