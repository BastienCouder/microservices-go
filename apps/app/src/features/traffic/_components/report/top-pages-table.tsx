import { FileText } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatInteger,
  formatPercent,
} from "../../_lib/report/traffic-report-formatters";
import type { GeoTrafficPage } from "../../_lib/report/types";
import { PaginationControls } from "./pagination-controls";
import { SectionTitle } from "@/components/shared/section-title";

type TopPagesTableProps = {
  pages: GeoTrafficPage[];
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
};

export function TopPagesTable({ pages, pagination, loading = false }: TopPagesTableProps) {
  return (
    <section className="rounded-md bg-card p-4 text-card-foreground">
      <div className="mb-4 flex flex-col gap-1">
        <SectionTitle>
          Top pages traffic
        </SectionTitle>
        <p className="text-xs text-muted-foreground">
          Pages publiques vues après une arrivée IA détectée. Les routes privées comme /admin sont masquées.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px_72px] gap-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <EmptyStateCard label="Aucune page disponible" className="h-28" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Visites IA détectées</TableHead>
              <TableHead className="text-right">Taux engagé</TableHead>
              <TableHead className="text-right">Conversions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={`${page.path}-${page.source}`}>
                <TableCell className="max-w-[300px]">
                  <div className="truncate font-medium">{page.title || page.path || "/"}</div>
                  <div className="truncate text-xs text-muted-foreground">{page.path || "/"}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{page.engine}</div>
                  <div className="text-xs text-muted-foreground">{page.source}</div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatInteger(page.sessions)}
                </TableCell>
                <TableCell className="text-right">{formatPercent(page.engagementRate)}</TableCell>
                <TableCell className="text-right">{formatInteger(page.conversions)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && pages.length > 0 ? <PaginationControls {...pagination} /> : null}
    </section>
  );
}
