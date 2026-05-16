import { KpiCard } from "@/components/shared/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrafficKpiItem } from "../../_lib/report/use-traffic-report-panel-view-model";

type TrafficKpiRowProps = {
  items: TrafficKpiItem[];
  loading?: boolean;
};

export function TrafficKpiRow({ items, loading = false }: TrafficKpiRowProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className="rounded-md bg-card p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {item.title}
              </span>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="mb-4 h-9 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <KpiCard
          key={item.title}
          title={item.title}
          value={item.value}
          sub={item.sub}
          description={item.description}
          trendDir="stable"
          variant={item.tone === "primary" ? "active" : "default"}
        />
      ))}
    </div>
  );
}
