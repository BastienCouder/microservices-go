import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import {
  PeriodFilterPicker,
  type PeriodFilterOption,
} from "@/components/shared/period-filter-picker";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/shared/utils";
import type { ContentOptimizerCrawlRecord } from "../../../_lib/content-optimizer-api";
import {
  columns,
  computeGeoKpiSummaries,
  computePriority,
  decodeHTMLText,
  formatSignalCount,
  geoInsightGroups,
  hostnameFromURL,
  issueSourceLabel,
  issuesForGeoInsightGroup,
  pathnameFromURL,
  primaryIssue,
  severityLabel,
  severityTone,
  statusLabel,
  statusTone,
  type CrawlColumn,
  type SeverityFilter,
  type SortKey,
  type StatusFilter,
} from "../_lib/crawl-panel-utils";

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "completed", label: "Terminé" },
  { value: "running", label: "En cours" },
  { value: "errored", label: "En erreur" },
  { value: "cancelled", label: "Annulé" },
] as const satisfies readonly PeriodFilterOption[];

export const SEVERITY_FILTER_OPTIONS = [
  { value: "all", label: "Toutes les sévérités" },
  { value: "high", label: "Haute" },
  { value: "medium", label: "Moyenne" },
  { value: "low", label: "Faible" },
  { value: "none", label: "Aucune erreur" },
] as const satisfies readonly PeriodFilterOption[];

type CrawlerResultsViewProps = {
  errorLabel?: string | null;
  loadingLatest: boolean;
  query: string;
  statusFilter: StatusFilter;
  severityFilter: SeverityFilter;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  records: ContentOptimizerCrawlRecord[];
  filteredRecords: ContentOptimizerCrawlRecord[];
  selectedRecord: ContentOptimizerCrawlRecord | null;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSeverityFilterChange: (value: SeverityFilter) => void;
  onToggleSort: (key: SortKey) => void;
  onSelectRecord: (url: string) => void;
};

function loadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-[280px]" />
          <Skeleton className="h-3 w-2/3 max-w-[220px]" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full max-w-[220px]" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24 rounded-full" />
      </TableCell>
    </TableRow>
  ));
}

function CrawlerKpiStrip({
  records,
}: {
  records: ContentOptimizerCrawlRecord[];
}) {
  const kpis = computeGeoKpiSummaries(records);

  return (
    <section
      className="border-b bg-muted/20 px-4 py-3"
      aria-label="KPIs GEO du contenu analysé"
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className={cn(
              "rounded-md border bg-background px-3 py-2.5 shadow-sm",
              kpi.tone === "success" && "border-emerald-200 bg-emerald-50/70",
              kpi.tone === "warning" && "border-amber-200 bg-amber-50/70",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {kpi.label}
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-xl font-bold leading-none text-foreground">
                {kpi.value}
              </p>
              <p className="truncate text-right text-[11px] font-medium text-muted-foreground">
                {kpi.caption}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CrawlerDetailPane({
  selectedRecord,
}: {
  selectedRecord: ContentOptimizerCrawlRecord | null;
}) {
  if (!selectedRecord) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyStateCard
          label="Sélectionnez une page pour afficher le détail."
          className="h-24 w-full"
        />
      </div>
    );
  }

  const selectedTitle = decodeHTMLText(selectedRecord.title) || selectedRecord.url;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {selectedTitle}
            </h3>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {selectedRecord.url}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">HTTP {selectedRecord.httpStatus ?? "-"}</Badge>
          <Badge variant="outline">
            {formatSignalCount(selectedRecord.issues?.length ?? 0)}
          </Badge>
          <Badge className={computePriority(selectedRecord).className}>
            {computePriority(selectedRecord).label}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section className="space-y-3">
          <SectionTitle showIndicator={false}>Diagnostic GEO</SectionTitle>
          <div className="grid gap-2">
            {geoInsightGroups.map((group) => {
              const groupIssues = issuesForGeoInsightGroup(
                selectedRecord.issues,
                group,
              );
              const hasIssues = groupIssues.length > 0;
              const topIssue = primaryIssue({
                ...selectedRecord,
                issues: groupIssues,
              });

              return (
                <div
                  key={group.id}
                  className={cn(
                    "rounded-md border bg-background p-3",
                    hasIssues && "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {group.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {decodeHTMLText(topIssue?.title ?? group.description)}
                      </p>
                    </div>
                    <Badge
                      variant={hasIssues ? "secondary" : "outline"}
                      className="h-6 shrink-0 rounded-sm px-2 text-xs font-bold"
                    >
                      {hasIssues ? formatSignalCount(groupIssues.length) : "OK"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {(selectedRecord.issues?.length ?? 0) > 0 ? (
          <section className="space-y-4">
            <SectionTitle showIndicator={false}>Opportunités d'amélioration</SectionTitle>
            <div className="space-y-3">
              {selectedRecord.issues?.map((issue, index) => (
                <button
                  type="button"
                  key={issue.id}
                  className="group w-full cursor-default rounded-md bg-background p-4 text-left transition-all ring-2 ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={decodeHTMLText(issue.title)}
                >
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground md:text-sm">
                        {decodeHTMLText(issue.title)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground md:text-xs">
                        Opportunité #{index + 1}
                      </p>
                    </div>

                    <Badge
                      className={cn(
                        "h-6 px-2 text-xs font-bold",
                        severityTone(issue.severity),
                      )}
                    >
                      {severityLabel(issue.severity)}
                    </Badge>
                    <Badge variant="outline" className="h-6 px-2 text-xs font-bold">
                      {issueSourceLabel(issue)}
                    </Badge>
                  </div>

                  <p className="mb-3 text-xs font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground md:text-sm">
                    {decodeHTMLText(issue.recommendation)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <EmptyStateCard label="Aucune opportunité prioritaire détectée sur cette page." />
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle showIndicator={false}>Contenu extrait</SectionTitle>
          </div>

          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-background p-4 text-sm leading-6 text-foreground">
            {selectedRecord.markdown?.trim() ||
              "Aucun contenu markdown extrait pour cette page."}
          </pre>
        </section>
      </div>
    </div>
  );
}

export function CrawlerResultsView({
  errorLabel,
  loadingLatest,
  query,
  statusFilter,
  severityFilter,
  sortKey,
  sortDirection,
  records,
  filteredRecords,
  selectedRecord,
  onQueryChange,
  onStatusFilterChange,
  onSeverityFilterChange,
  onToggleSort,
  onSelectRecord,
}: CrawlerResultsViewProps) {
  function renderSortIcon(columnKey: SortKey) {
    if (sortKey !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  }

  return (
    <>
    {/*   <CrawlerKpiStrip records={records} /> */}

      <div className="border-b px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Rechercher par titre ou URL"
                className="pl-9"
              />
            </div>

            <PeriodFilterPicker
              className="w-full sm:w-[220px]"
              value={statusFilter}
              onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
              options={STATUS_FILTER_OPTIONS}
              label="Statut"
              title="Statut"
            />

            <PeriodFilterPicker
              className="w-full sm:w-[220px]"
              value={severityFilter}
              onValueChange={(value) =>
                onSeverityFilterChange(value as SeverityFilter)
              }
              options={SEVERITY_FILTER_OPTIONS}
              label="Sévérité"
              title="Sévérité"
            />
          </div>

        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-h-0 overflow-auto border-r">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {columns.map((column) => {
                  const sortMap: Partial<Record<CrawlColumn["id"], SortKey>> = {
                    page: "page",
                    http: "http",
                    status: "status",
                    priority: "priority",
                    findings: "findings",
                  };

                  const sortableKey = sortMap[column.id];

                  return (
                    <TableHead
                      className={cn(
                        "h-12 px-3 text-sm font-semibold text-muted-foreground",
                        column.className,
                      )}
                      key={column.id}
                    >
                      {sortableKey ? (
                        <button
                          type="button"
                          onClick={() => onToggleSort(sortableKey)}
                          className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                        >
                          <span>{column.label}</span>
                          {renderSortIcon(sortableKey)}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:px-3 [&_td]:py-3">
              {loadingLatest ? (
                loadingRows()
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-6"
                  >
                    <EmptyStateCard
                      label={
                        errorLabel ||
                        (records.length === 0
                          ? "Aucun résultat disponible."
                          : "Aucun résultat ne correspond aux filtres actuels.")
                      }
                      className="h-24"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => {
                  const priority = computePriority(record);
                  const isSelected = selectedRecord?.url === record.url;
                  const recordTitle = decodeHTMLText(record.title) || record.url;

                  return (
                    <TableRow
                      key={record.url}
                      tabIndex={0}
                      aria-selected={isSelected}
                      data-state={isSelected ? "selected" : undefined}
                      onClick={() => onSelectRecord(record.url)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectRecord(record.url);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-l-2 border-l-transparent transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        isSelected && "border-l-primary bg-muted/50",
                      )}
                    >
                      <TableCell className="max-w-[360px] whitespace-normal">
                        <div className="space-y-1">
                          <div className="line-clamp-2 text-sm font-medium leading-6">
                            {recordTitle}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatSignalCount(record.issues?.length ?? 0)}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[320px] whitespace-normal">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {hostnameFromURL(record.url)}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {pathnameFromURL(record.url)}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{record.httpStatus ?? "-"}</TableCell>

                      <TableCell>
                        <Badge variant={statusTone(record.status)}>
                          {statusLabel(record.status)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge className={priority.className}>
                          {priority.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="whitespace-normal">
                        <Badge variant="outline">
                          {formatSignalCount(record.issues?.length ?? 0)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <aside className="min-h-0 overflow-auto bg-background">
          <CrawlerDetailPane selectedRecord={selectedRecord} />
        </aside>
      </div>
    </>
  );
}
