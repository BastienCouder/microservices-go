"use client";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERCEPTION_HEATMAP_AXIS_COLORS } from "@/lib/app-data";
import { SectionTitle } from "@/components/shared/section-title";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getPerceptionAxisLabel, getPerceptionHeatmapGradeLabel } from "../_lib";

type HeatmapAxis = {
  key: string;
  label: string;
  color: string;
};

type HeatmapRow = {
  model: string;
  values: Record<string, number>;
};

function scoreToCellStyle(score: number, axisKey: string) {
  const clamped = Math.max(0, Math.min(100, score));
  const alpha = 0.12 + (clamped / 100) * 0.78;
  return {
    backgroundColor: `color-mix(in oklab, ${PERCEPTION_HEATMAP_AXIS_COLORS[axisKey] ?? "hsl(var(--primary))"} ${Math.round(alpha * 100)}%, white)`,
  };
}

function textForScore(score: number, locale: string) {
  return getPerceptionHeatmapGradeLabel(score, locale);
}

export function PerceptionModelAxisHeatmap({
  axes,
  rows,
  periodLabel,
  emptyLabel,
}: {
  axes: HeatmapAxis[];
  rows: HeatmapRow[];
  periodLabel: string;
  emptyLabel?: string | null;
}) {
  const { locale, t } = useScopedI18n("perception");
  return (
    <Card className="min-w-0 border-border/60">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">
              <SectionTitle>{t("heatmapTitle")}</SectionTitle>
            </CardTitle>
            <CardDescription>{t("heatmapDescription")}</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0 bg-muted/50 text-xs font-normal uppercase text-muted-foreground md:text-sm">
            {periodLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        {axes.length === 0 || rows.length === 0 ? (
          <EmptyStateCard label={emptyLabel || t("heatmapEmpty")} className="h-[220px] text-sm" />
        ) : (
          <div className="space-y-3">
            <div className="space-y-3 lg:hidden">
              {rows.map((row) => (
                <div key={`mobile-${row.model}`} className="rounded-xl border border-border/50 p-3">
                  <div className="mb-2 text-sm font-semibold">{row.model}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {axes.map((axis) => {
                      const score = row.values[axis.key] ?? 0;
                      const axisLabel = getPerceptionAxisLabel(axis.key as never, locale);
                      return (
                        <div
                          key={`mobile-${row.model}-${axis.key}`}
                          className="rounded-lg border border-border/40 px-2 py-2"
                          style={scoreToCellStyle(score, axis.key)}
                        >
                          <div className="text-[10px] font-medium text-foreground/80">{axisLabel}</div>
                          <div className="mt-1 text-sm font-semibold tabular-nums">{score}</div>
                          <div className="text-[10px] text-foreground/80">{textForScore(score, locale)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden lg:block">
              <div className="mb-2 grid grid-cols-[120px_1fr] gap-2">
                <div className="px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {t("heatmapModelColumn")}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${axes.length}, minmax(0, 1fr))` }}>
                  {axes.map((axis) => (
                    <div key={`header-${axis.key}`} className="px-1 text-center text-[11px] font-medium text-muted-foreground">
                      {getPerceptionAxisLabel(axis.key as never, locale)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={`desktop-${row.model}`} className="grid grid-cols-[120px_1fr] gap-2">
                    <div className="flex items-center rounded-lg bg-muted/40 px-2 py-2 text-sm font-medium">
                      <span className="truncate">{row.model}</span>
                    </div>
                    <div
                      className="grid min-w-0 gap-2"
                      style={{ gridTemplateColumns: `repeat(${axes.length}, minmax(0, 1fr))` }}
                    >
                      {axes.map((axis) => {
                        const score = row.values[axis.key] ?? 0;
                        const axisLabel = getPerceptionAxisLabel(axis.key as never, locale);
                        return (
                          <div
                            key={`desktop-${row.model}-${axis.key}`}
                            className="min-w-0 rounded-lg border border-border/40 px-1 py-2 text-center"
                            style={scoreToCellStyle(score, axis.key)}
                            title={`${row.model} • ${axisLabel}: ${score}/100`}
                          >
                            <div className="text-xs font-semibold tabular-nums text-foreground">{score}</div>
                            <div className="truncate text-[10px] text-foreground/80">{textForScore(score, locale)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
