"use client";

import { useMemo } from "react";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerceptionViewData } from "../_lib/shared/perception-data";
import { PERCEPTION_DONUT_COLORS, PERCEPTION_VISIBLE_AXES } from "@/lib/app-data";
import { SectionTitle } from "@/components/shared/section-title";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getPerceptionAxisLabel, getPerceptionGradeLabel } from "../_lib";

type RankedPoint = PerceptionViewData["radar"][number] & {
  color: string;
};

export function PerceptionDonutVisual({
  points,
  periodLabel,
  emptyLabel,
  loadingNumbers = false,
}: {
  points: PerceptionViewData["radar"];
  periodLabel: string;
  emptyLabel?: string | null;
  loadingNumbers?: boolean;
}) {
  const { locale, t } = useScopedI18n("perception");
  const rankedPoints = useMemo<RankedPoint[]>(() => {
    const byAxis = new Map(points.map((point) => [point.axis, point] as const));
    const orderedPoints: RankedPoint[] = [];

    for (const axis of PERCEPTION_VISIBLE_AXES) {
      const point = byAxis.get(axis);
      if (!point) continue;
      orderedPoints.push({
        ...point,
        color: PERCEPTION_DONUT_COLORS.axis[axis],
      });
    }

    return [...orderedPoints].sort((left, right) => right.score - left.score);
  }, [points]);

  if (rankedPoints.length === 0) {
    return (
      <div className="px-5 py-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <SectionTitle>{t("donutTitle")}</SectionTitle>
            <p className="mt-2 hidden max-w-2xl text-sm text-muted-foreground md:block">{t("donutSubtitle")}</p>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0 bg-muted/50 text-xs font-normal uppercase text-muted-foreground md:text-sm">
            {periodLabel}
          </Badge>
        </div>
        <EmptyStateCard label={emptyLabel || t("donutEmpty")} className="mt-3 h-[220px] text-sm" />
      </div>
    );
  }

  return (
    <div className="px-5 py-3">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <SectionTitle>{t("donutTitle")}</SectionTitle>
          <p className="mt-2 hidden max-w-2xl text-sm text-muted-foreground md:block">{t("donutSubtitle")}</p>
        </div>
        <Badge variant="secondary" className="w-fit shrink-0 bg-muted/50 text-xs font-normal uppercase text-muted-foreground md:text-sm">
          {periodLabel}
        </Badge>
      </div>
      <div className="mt-3 space-y-3">
        {rankedPoints.map((point, index) => (
          <AxisProgressRow
            key={point.axis}
            point={point}
            rank={index + 1}
            locale={locale}
            loadingNumber={loadingNumbers}
          />
        ))}
      </div>
    </div>
  );
}

function AxisProgressRow({
  point,
  rank,
  locale,
  loadingNumber,
}: {
  point: RankedPoint;
  rank: number;
  locale: string;
  loadingNumber: boolean;
}) {
  const { t } = useScopedI18n("perception");
  const progressWidth = `${Math.max(0, Math.min(100, point.score))}%`;
  const targetOffset = `calc(${Math.max(0, Math.min(100, point.target))}% - 1px)`;
  const delta = point.score - point.target;
  const statusLabel = delta >= 0 ? t("donutAboveTarget") : t("donutBelowTarget");
  const gradeLabel = getPerceptionGradeLabel(point.score, locale);
  const axisLabel = getPerceptionAxisLabel(point.axis, locale);

  return (
    <div className="rounded-xl border border-border/60 bg-background/85 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-2 text-sm font-semibold tabular-nums text-background"
            style={{ backgroundColor: point.color }}
          >
            {rank}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{axisLabel}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
              <span className="font-medium text-foreground/80">{gradeLabel}</span>
              <span className="text-muted-foreground">•</span>
              <span className={cn(delta >= 0 ? "text-emerald-700" : "text-amber-700")}>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {loadingNumber ? (
            <Skeleton className="ml-auto h-7 w-10 rounded-md" />
          ) : (
            <div className="text-xl font-semibold tabular-nums" style={{ color: point.color }}>
              {point.score}
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">/100</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="relative h-3.5 overflow-hidden rounded-full bg-muted/50">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: progressWidth,
              backgroundColor: point.color,
            }}
          />
          <div className="absolute inset-y-[-3px] w-px bg-foreground/45" style={{ left: targetOffset }} />
        </div>
      </div>
    </div>
  );
}
