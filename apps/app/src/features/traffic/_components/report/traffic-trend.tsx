import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  formatDateLabel,
  formatInteger,
} from "../../_lib/report/traffic-report-formatters";
import { getTrafficTrendPresentation } from "../../_lib/report/traffic-trend-presentation";
import type { TrafficDailyPoint } from "../../_lib/report/types";
import { SectionTitle } from "@/components/shared/section-title";

type TrafficTrendProps = {
  errorLabel?: string | null;
  points: TrafficDailyPoint[];
  loading?: boolean;
};

export function TrafficTrend({ errorLabel, points, loading = false }: TrafficTrendProps) {
  const isMobile = useIsMobile();
  const presentation = getTrafficTrendPresentation(points, isMobile);
  const visiblePoints = presentation.points;
  const maxSessions = Math.max(1, ...visiblePoints.map((point) => point.sessions));
  const hasSinglePoint = visiblePoints.length === 1;

  return (
    <section className="min-w-0 overflow-hidden rounded-md bg-card p-4 text-card-foreground">
      <div className="mb-4 flex flex-col gap-1">
        <SectionTitle>
          Trafic dans le temps
        </SectionTitle>
        <p className="text-xs text-muted-foreground">Visites IA détectées agrégées par jour.</p>
      </div>

      <div
        className={cn(
          "min-w-0 overflow-hidden rounded-md border border-border bg-background",
          presentation.chartClassName,
        )}
      >
        {loading ? (
          <div className={cn("flex h-full items-end", presentation.barGapClassName)}>
            {Array.from({ length: visiblePoints.length || (isMobile ? 7 : 14) }).map((_, index) => (
              <div key={index} className="flex h-full min-w-0 flex-1 items-end">
                <Skeleton
                  className="w-full rounded-t-md"
                  style={{ height: `${24 + ((index * 11) % 58)}%` }}
                />
              </div>
            ))}
          </div>
        ) : visiblePoints.length === 0 ? (
          <div className="flex h-full min-w-0 items-center">
            <EmptyStateCard label={errorLabel || "Aucune série disponible"} className="h-full min-h-0 w-full" />
          </div>
        ) : (
          <div
            className={cn(
              "flex h-full min-w-0 items-end",
              presentation.barGapClassName,
              hasSinglePoint && "justify-center",
            )}
          >
            {visiblePoints.map((point, index) => {
              const height = Math.max(8, (point.sessions / maxSessions) * 100);
              const showLabel =
                hasSinglePoint ||
                index % presentation.showEveryLabel === 0 ||
                index === visiblePoints.length - 1;
              return (
                <div
                  key={point.date}
                  className={cn(
                    "flex h-full min-w-0 flex-col items-center justify-end gap-3",
                    hasSinglePoint ? "w-16 shrink-0" : "flex-1",
                  )}
                >
                  <div className="flex h-full w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-primary transition-[height]"
                      style={{ height: `${height}%` }}
                      title={`${formatInteger(point.sessions)} visites IA détectées`}
                    />
                  </div>
                  <div className="flex min-h-[28px] w-full items-start justify-center pt-1">
                    <span
                      className={cn(
                        "block max-w-full truncate text-muted-foreground",
                        hasSinglePoint
                          ? "w-full text-center text-[10px] leading-tight"
                          : presentation.labelClassName,
                        !showLabel && "opacity-0",
                      )}
                    >
                      {showLabel ? formatDateLabel(point.date) : "\u00A0"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
