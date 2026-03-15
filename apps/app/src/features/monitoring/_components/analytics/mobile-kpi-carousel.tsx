"use client";

import { useI18nScope } from "@/shared/hooks/use-i18n";

import { KpiCard } from "../shared/kpi-card";

type MobileKpiCarouselProps = {
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

export function MobileKpiCarousel(props: MobileKpiCarouselProps) {
  const content = useI18nScope("monitoring-analytics-panel");

  return (
    <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
      <div className="flex w-max snap-x snap-mandatory gap-3 pb-1 pr-4">
        <div className="w-[280px] snap-start">
          <KpiCard
            title={content.kpiMentionRateTitle}
            value={props.mentionRateValue}
            sub={props.mentionRateSub}
            trend={props.mentionTrend}
            trendDir={props.mentionTrendDir}
            variant="active"
          />
        </div>
        <div className="w-[280px] snap-start">
          <KpiCard
            title={content.kpiVisibilityScoreTitle}
            value={props.visibilityScoreValue}
            sub={props.visibilitySub}
            trend={props.visibilityTrend}
            trendDir={props.visibilityTrendDir}
          />
        </div>
        <div className="w-[280px] snap-start">
          <KpiCard
            title={content.kpiAvgPositionTitle}
            value={props.avgPositionValue}
            sub={props.avgPositionSub}
            trend={props.avgPositionTrend}
            trendDir={props.avgPositionTrendDir}
          />
        </div>
      </div>
    </div>
  );
}
