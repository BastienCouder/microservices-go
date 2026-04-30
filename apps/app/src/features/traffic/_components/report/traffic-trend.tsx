import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatDateLabel,
  formatInteger,
} from "../../_lib/report/traffic-report-formatters";
import type { GeoTrafficDailyPoint } from "../../_lib/report/types";
import { SectionTitle } from "@/components/shared/section-title";

type TrafficTrendProps = {
  points: GeoTrafficDailyPoint[];
  loading?: boolean;
};

export function TrafficTrend({ points, loading = false }: TrafficTrendProps) {
  const visiblePoints = points.slice(-14);
  const maxSessions = Math.max(1, ...visiblePoints.map((point) => point.sessions));
  const hasSinglePoint = visiblePoints.length === 1;

  return (
    <section className="min-w-0 overflow-hidden rounded-md bg-card p-4 text-card-foreground">
      <div className="mb-4 flex flex-col gap-1">
        <SectionTitle>
          Trafic dans le temps
        </SectionTitle>
        <p className="text-xs text-muted-foreground">Sessions traffic agrégées par jour.</p>
      </div>

      <div className="h-36 min-w-0 overflow-hidden rounded-md border border-border bg-background px-3 pb-9 pt-4">
        {loading ? (
          <div className="flex h-full items-end gap-2">
            {Array.from({ length: 14 }).map((_, index) => (
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
            <EmptyStateCard label="Aucune série disponible" className="h-full min-h-0 w-full" />
          </div>
        ) : (
          <div
            className={cn(
              "flex h-full min-w-0 items-end gap-2",
              hasSinglePoint && "justify-center",
            )}
          >
            {visiblePoints.map((point) => {
              const height = Math.max(8, (point.sessions / maxSessions) * 100);
              return (
                <div
                  key={point.date}
                  className={cn(
                    "flex h-full min-w-0 flex-col justify-end gap-2",
                    hasSinglePoint ? "w-16 shrink-0" : "flex-1",
                  )}
                >
                  <div className="flex h-full items-end">
                    <div
                      className="w-full rounded-t-md bg-primary/85 transition-[height]"
                      style={{ height: `${height}%` }}
                      title={`${formatInteger(point.sessions)} sessions`}
                    />
                  </div>
                  <span
                    className={cn(
                      "block truncate text-[10px] leading-none text-muted-foreground",
                      hasSinglePoint ? "text-center" : "origin-top-left rotate-[-35deg]",
                    )}
                  >
                    {formatDateLabel(point.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
