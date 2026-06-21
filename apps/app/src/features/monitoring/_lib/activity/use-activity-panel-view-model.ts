import { useCallback, useMemo, useState } from "react";

import { useMonitoringData } from "../shared/use-monitoring-data";
import {
  type MonitoringData,
  type MonitoringPrompt,
} from "../shared/monitoring-data";

import { exportMonitoringWorkbook } from "../shared/monitoring-export";
import { useClientExportAccess } from "@/shared/export-entitlements";
import {
  filterPromptsByScope,
  promptIsInPeriodWithDateRange,
} from "../shared/prompt-filters";
import { useMonitoringFilters } from "../shared/use-monitoring-filters";
import { buildTopCitedPagesFromPrompts } from "../analytics/analytics-utils";
import { buildAutomaticInsights } from "../analytics/analytics-panel-helpers";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";

type MonitoringAlert = MonitoringData["alerts"][number];

function getPromptSortValue(prompt: MonitoringPrompt): number {
  if (prompt.createdAt) {
    const createdAt = new Date(prompt.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      return createdAt.getTime();
    }
  }

  const normalizedTime = prompt.time.trim().toLowerCase();
  const match = normalizedTime.match(/^(\d+)\s*(m|h|d)$/);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "m" ? 60 * 1000 : unit === "h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  return Date.now() - amount * multiplier;
}

function buildAlertCreatedAt(prompts: MonitoringPrompt[]): string | undefined {
  const createdAt = prompts
    .map((prompt) => prompt.createdAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => {
      const leftTime = new Date(left).getTime();
      const rightTime = new Date(right).getTime();
      return rightTime - leftTime;
    })[0];

  return createdAt;
}

type ActivityPanelViewModel = {
  loading: boolean;
  apiBaseURL: string;
  routeSearch: string;
  refresh: () => Promise<void>;
  filteredAlerts: MonitoringAlert[];
  filteredPrompts: MonitoringPrompt[];
  canExport: boolean;
  exportDisabled: boolean;
  handleExportMonitoringData: () => void;
  selectedAlert: MonitoringAlert | null;
  selectedPrompt: MonitoringPrompt | null;
  selectAlert: (alert: MonitoringAlert) => void;
  closeAlert: () => void;
  selectPrompt: (prompt: MonitoringPrompt) => void;
  closePrompt: () => void;
};

export function useActivityPanelViewModel(): ActivityPanelViewModel {
  const filters = useMonitoringFilters();
  const analyticsContent = useI18nScope("monitoring-analytics-panel");
  const { t } = useScopedI18n("monitoring-analytics-panel");
  const {
    data: monitoringData,
    loading,
    apiBaseURL,
    routeSearch,
    refresh,
  } = useMonitoringData();
  const exportAccess = useClientExportAccess();
  const { models, recent_prompts } = monitoringData;
  const [selectedPrompt, setSelectedPrompt] = useState<MonitoringPrompt | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<MonitoringAlert | null>(null);
  const automaticInsightsCopy = useMemo(
    () => ({
      brandMentionTemplate: ({
        label,
        mentions,
        total,
      }: {
        label: string;
        mentions: number;
        total: number;
      }) => t("brandMentionTemplate", { label, mentions, total }),
      coMentionsModel: analyticsContent.coMentionsAnalyticsTitle,
      coMentionsTemplate: ({
        competitor,
        mentions,
        total,
      }: {
        competitor: string;
        mentions: number;
        total: number;
      }) => t("coMentionsTemplate", { competitor, mentions, total }),
      competitionModel: analyticsContent.competitionModel,
      competitionTemplate: ({ competitor }: { competitor: string }) =>
        t("competitionTemplate", { competitor }),
      topCitedTemplate: ({ url }: { url: string }) => t("topCitedTemplate", { url }),
      qualityModel: analyticsContent.qualityModel,
      qualityTemplate: ({ score }: { score: number }) => t("qualityTemplate", { score }),
    }),
    [
      analyticsContent.coMentionsAnalyticsTitle,
      analyticsContent.competitionModel,
      analyticsContent.qualityModel,
      t,
    ],
  );

  const filteredPrompts = useMemo(
    () =>
      [...filterPromptsByScope(recent_prompts, filters)].sort(
        (left, right) => getPromptSortValue(right) - getPromptSortValue(left),
    ),
    [filters, recent_prompts],
  );
  const promptsForCalculatedAlerts = useMemo(
    () =>
      filterPromptsByScope(recent_prompts, filters, { applyPeriod: false }).filter(
        (prompt) =>
          promptIsInPeriodWithDateRange(
            prompt,
            filters.period,
            filters.dateRange,
          ),
      ),
    [filters, recent_prompts],
  );
  const filteredAlerts = useMemo(
    () => {
      const topCitedPages = buildTopCitedPagesFromPrompts(
        promptsForCalculatedAlerts,
      ).slice(0, 3);

      return buildAutomaticInsights({
        prompts: promptsForCalculatedAlerts,
        models,
        selectedCompetitors: filters.selectedCompetitors,
        topCitedPages,
        insightCitationsLabel: analyticsContent.insightCitationsLabel,
        copy: automaticInsightsCopy,
      }).map((insight): MonitoringAlert => ({
        type: insight.level === "high" ? "critical" : "warning",
        prompts: insight.model,
        msg: insight.text,
        time: insight.delta,
        isRead: false,
        createdAt: buildAlertCreatedAt(promptsForCalculatedAlerts),
        modelIds: Array.from(
          new Set(promptsForCalculatedAlerts.map((prompt) => prompt.modelId)),
        ),
        personas: Array.from(
          new Set(
            promptsForCalculatedAlerts
              .map((prompt) => prompt.persona)
              .filter(Boolean),
          ),
        ),
        competitors: Array.from(
          new Set(promptsForCalculatedAlerts.flatMap((prompt) => prompt.competitorsMentioned)),
        ),
      }));
    },
    [
      analyticsContent.insightCitationsLabel,
      automaticInsightsCopy,
      filters.selectedCompetitors,
      models,
      promptsForCalculatedAlerts,
    ],
  );

  const selectAlert = useCallback((alert: MonitoringAlert) => setSelectedAlert(alert), []);
  const closeAlert = useCallback(() => setSelectedAlert(null), []);
  const selectPrompt = useCallback((prompt: MonitoringPrompt) => setSelectedPrompt(prompt), []);
  const closePrompt = useCallback(() => setSelectedPrompt(null), []);
  const handleExportMonitoringData = useCallback(() => {
    exportMonitoringWorkbook({
      data: monitoringData,
      filteredPrompts,
      filters,
    });
  }, [filteredPrompts, filters, monitoringData]);

  return {
    loading,
    apiBaseURL,
    routeSearch,
    refresh,
    filteredAlerts,
    filteredPrompts,
    canExport: exportAccess.canExport,
    exportDisabled: filteredPrompts.length === 0,
    handleExportMonitoringData,
    selectedAlert,
    selectedPrompt,
    selectAlert,
    closeAlert,
    selectPrompt,
    closePrompt,
  };
}
