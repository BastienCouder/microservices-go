import { ExternalLink } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Skeleton } from "@/components/ui/skeleton";
import { getTrafficEngineIconPath } from "../../_lib/report/traffic-engine-assets";
import { formatInteger, formatPercent } from "../../_lib/report/traffic-report-formatters";
import type { TrafficSource } from "../../_lib/report/types";
import { PaginationControls } from "./pagination-controls";

type SourceBreakdownProps = {
  errorLabel?: string | null;
  sources: TrafficSource[];
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
};

export function SourceBreakdown({ errorLabel, sources, pagination, loading = false }: SourceBreakdownProps) {
  const maxSessions = Math.max(1, ...sources.map((source) => source.sessions));

  return (
    <section className="rounded-md bg-card p-4 text-card-foreground">
      <div className="mb-4 flex flex-col gap-1">
        <SectionTitle>
          Sources IA détectées
        </SectionTitle>
        <p className="text-xs text-muted-foreground">Moteurs génératifs identifiés par la source, le référent ou les UTM GA4.</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))
        ) : sources.length === 0 ? (
          <EmptyStateCard label={errorLabel || "Aucune source disponible"} className="h-28" />
        ) : (
          sources.map((source) => {
            const width = Math.max(6, (source.sessions / maxSessions) * 100);
            return (
              <div key={`${source.source}-${source.medium}`} className="space-y-1.5">
                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-background shadow-sm ring-1 ring-border">
                      <img
                        src={getTrafficEngineIconPath(source.engine)}
                        alt=""
                        className="size-4"
                        loading="lazy"
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-foreground">{source.engine}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="break-all text-xs text-muted-foreground sm:truncate">{source.source}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <div className="font-semibold">{formatInteger(source.sessions)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatPercent(source.shareOfTrafficSessions)}
                    </div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && sources.length > 0 ? <PaginationControls {...pagination} /> : null}
    </section>
  );
}
