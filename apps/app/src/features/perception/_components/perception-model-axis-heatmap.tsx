"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERCEPTION_HEATMAP_AXIS_COLORS, PERCEPTION_TEXT } from "@/lib/app-data";
import { DashboardSectionTitle } from "@/features/monitoring/_components/dashboard-section-title";

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

function textForScore(score: number) {
  if (score >= 80) return PERCEPTION_TEXT.heatmap.grades.excellent;
  if (score >= 65) return PERCEPTION_TEXT.heatmap.grades.good;
  if (score >= 50) return PERCEPTION_TEXT.heatmap.grades.medium;
  return PERCEPTION_TEXT.heatmap.grades.low;
}

export function PerceptionModelAxisHeatmap({
  axes,
  rows,
}: {
  axes: HeatmapAxis[];
  rows: HeatmapRow[];
}) {
  return (
    <Card className="min-w-0 border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          <DashboardSectionTitle>{PERCEPTION_TEXT.heatmap.title}</DashboardSectionTitle>
        </CardTitle>
        <CardDescription>{PERCEPTION_TEXT.heatmap.description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="space-y-3">
          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <div key={`mobile-${row.model}`} className="rounded-lg border border-border/50 p-3">
                <div className="mb-2 text-sm font-semibold">{row.model}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {axes.map((axis) => {
                    const score = row.values[axis.key] ?? 0;
                    return (
                      <div
                        key={`mobile-${row.model}-${axis.key}`}
                        className="rounded-md border border-border/40 px-2 py-2"
                        style={scoreToCellStyle(score, axis.key)}
                      >
                        <div className="text-[10px] font-medium text-foreground/80">{axis.label}</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums">{score}</div>
                        <div className="text-[10px] text-foreground/80">{textForScore(score)}</div>
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
                {PERCEPTION_TEXT.heatmap.modelColumn}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${axes.length}, minmax(0, 1fr))` }}>
                {axes.map((axis) => (
                  <div key={`header-${axis.key}`} className="px-1 text-center text-[11px] font-medium text-muted-foreground">
                    {axis.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {rows.map((row) => (
                <div key={`desktop-${row.model}`} className="grid grid-cols-[120px_1fr] gap-2">
                  <div className="flex items-center rounded-md bg-muted/40 px-2 py-2 text-sm font-medium">
                    <span className="truncate">{row.model}</span>
                  </div>
                  <div
                    className="grid min-w-0 gap-2"
                    style={{ gridTemplateColumns: `repeat(${axes.length}, minmax(0, 1fr))` }}
                  >
                    {axes.map((axis) => {
                      const score = row.values[axis.key] ?? 0;
                      return (
                        <div
                          key={`desktop-${row.model}-${axis.key}`}
                          className="min-w-0 rounded-md border border-border/40 px-1 py-2 text-center"
                          style={scoreToCellStyle(score, axis.key)}
                          title={`${row.model} • ${axis.label}: ${score}/100`}
                        >
                          <div className="text-xs font-semibold tabular-nums text-foreground">{score}</div>
                          <div className="truncate text-[10px] text-foreground/80">{textForScore(score)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {axes.map((axis) => (
              <div key={`legend-${axis.key}`} className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2 py-1 text-[10px]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: axis.color }} />
                <span>{axis.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
