"use client";

import { memo } from "react";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { KpiCard } from "../shared/kpi-card";

type KpiGridProps = {
  mentionRateValue: string;
  mentionRateSub: string;
  mentionTrend: string;
  mentionTrendDir: "up" | "down" | "stable";
  visibilityScoreValue: string;
  visibilitySub: string;
  visibilityTrend: string;
  visibilityTrendDir: "up" | "down" | "stable";
  avgPositionValue: string;
  avgPositionSub: string;
  avgPositionTrend: string;
  avgPositionTrendDir: "up" | "down" | "stable";
};

export const KpiOverviewGrid = memo(function KpiOverviewGrid(props: KpiGridProps) {
  const content = useI18nScope("monitoring-analytics-panel");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        title={content.kpiMentionRateTitle}
        value={props.mentionRateValue}
        sub={props.mentionRateSub}
        trend={props.mentionTrend}
        trendDir={props.mentionTrendDir}
        variant="active"
      />
      <KpiCard
        title={content.kpiVisibilityScoreTitle}
        value={props.visibilityScoreValue}
        sub={props.visibilitySub}
        trend={props.visibilityTrend}
        trendDir={props.visibilityTrendDir}
      />
      <KpiCard
        title={content.kpiAvgPositionTitle}
        value={props.avgPositionValue}
        sub={props.avgPositionSub}
        trend={props.avgPositionTrend}
        trendDir={props.avgPositionTrendDir}
      />
    </div>
  );
});
