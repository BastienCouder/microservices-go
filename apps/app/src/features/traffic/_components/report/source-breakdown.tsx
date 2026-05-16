import { ExternalLink } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInteger, formatPercent } from "../../_lib/report/traffic-report-formatters";
import type { GeoTrafficSource } from "../../_lib/report/types";
import { PaginationControls } from "./pagination-controls";

type SourceBreakdownProps = {
  sources: GeoTrafficSource[];
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
};

export function SourceBreakdown({ sources, pagination, loading = false }: SourceBreakdownProps) {
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
          <EmptyStateCard label="Aucune source disponible" className="h-28" />
        ) : (
          sources.map((source) => {
            const width = Math.max(6, (source.sessions / maxSessions) * 100);
            return (
              <div key={`${source.source}-${source.medium}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate font-medium text-foreground">{source.engine}</span>
                    <span className="truncate text-xs text-muted-foreground">{source.source}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{formatInteger(source.sessions)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatPercent(source.shareOfGeoSessions)}
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
