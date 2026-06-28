import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import {
  PeriodFilterPicker,
  type PeriodFilterOption,
} from "@/components/shared/period-filter-picker";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { ContentOptimizerCrawlRecord } from "../../../_lib/content-optimizer-api";
import type { ModelCatalogItem } from "@/features/models/_lib/model-access";
import {
  computePriority,
  decodeHTMLText,
  geoInsightGroups,
  hostnameFromURL,
  issuesForGeoInsightGroup,
  pathnameFromURL,
  primaryIssue,
  severityTone,
  statusTone,
  type SeverityFilter,
  type SortKey,
  type StatusFilter,
} from "../_lib/crawl-panel-utils";

type CrawlerResultsViewProps = {
  errorLabel?: string | null;
  loadingLatest: boolean;
  running: boolean;
  remainingCount: number;
  query: string;
  statusFilter: StatusFilter;
  severityFilter: SeverityFilter;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  records: ContentOptimizerCrawlRecord[];
  filteredRecords: ContentOptimizerCrawlRecord[];
  selectedRecord: ContentOptimizerCrawlRecord | null;
  diagnosticsVerified: boolean;
  analysisModels: ModelCatalogItem[];
  selectedAnalysisModelId: string;
  onSelectedAnalysisModelIdChange: (value: string) => void;
  analysisRunning: boolean;
  canAnalyze: boolean;
  onAnalyze: (model: ModelCatalogItem, record: ContentOptimizerCrawlRecord) => Promise<void>;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSeverityFilterChange: (value: SeverityFilter) => void;
  onToggleSort: (key: SortKey) => void;
  onSelectRecord: (url: string) => void;
};

function loadingRows(count = 6) {
  return Array.from({ length: count }).map((_, index) => (
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

function loadingCards(count = 4) {
  return Array.from({ length: count }).map((_, index) => (
    <div key={index} className="rounded-md border bg-background p-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Skeleton className="h-6 rounded-full" />
        <Skeleton className="h-6 rounded-full" />
        <Skeleton className="h-6 rounded-full" />
      </div>
    </div>
  ));
}

function signalCountLabel(
  count: number,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return t("signalCount", { count });
}

function statusDisplayLabel(
  status: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (status === "completed") return t("statusCompleted");
  if (status === "running") return t("statusRunning");
  if (status === "errored") return t("statusErrored");
  if (status.includes("cancelled")) return t("statusCancelled");
  return status;
}

function severityDisplayLabel(
  severity: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (severity === "high") return t("severityHigh");
  if (severity === "medium") return t("severityMedium");
  if (severity === "low") return t("severityLow");
  return "-";
}

function priorityDisplayLabel(
  rank: number,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (rank >= 4) return t("priorityCritical");
  if (rank === 3) return t("priorityHigh");
  if (rank === 2) return t("priorityMedium");
  return t("priorityLow");
}

function issueSourceDisplayLabel(
  issue: { source?: string; fixType?: string },
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (issue.source === "ai" || issue.fixType?.startsWith("ai_")) {
    return t("issueSourceAi");
  }
  return t("issueSourceRule");
}

function CrawlerDetailPane({
  selectedRecord,
  diagnosticsVerified,
  analysisRunning,
  canAnalyze,
  analysisAvailable,
  onRequestAnalysis,
}: {
  selectedRecord: ContentOptimizerCrawlRecord | null;
  diagnosticsVerified: boolean;
  analysisRunning: boolean;
  canAnalyze: boolean;
  analysisAvailable: boolean;
  onRequestAnalysis: () => void;
}) {
  const { t } = useScopedI18n("crawler-panel");

  if (!selectedRecord) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyStateCard
          label={t("selectPageForDetails")}
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">HTTP {selectedRecord.httpStatus ?? "-"}</Badge>
          <Badge variant="outline">
            {signalCountLabel(selectedRecord.issues?.length ?? 0, t)}
          </Badge>
          <Badge className={computePriority(selectedRecord).className}>
            {priorityDisplayLabel(computePriority(selectedRecord).rank, t)}
          </Badge>
          {canAnalyze ? (
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              disabled={analysisRunning || !analysisAvailable}
              onClick={onRequestAnalysis}
            >
              {analysisRunning ? <Loader2 className="size-4 animate-spin" /> : null}
              {analysisRunning
                ? t("analysisInProgress")
                : analysisAvailable
                  ? t("analyzeDiagnostics")
                  : t("noAnalysisModel")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section className="space-y-3">
          <SectionTitle showIndicator={false}>{t("geoDiagnosis")}</SectionTitle>
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
                      {hasIssues
                        ? signalCountLabel(groupIssues.length, t)
                        : diagnosticsVerified
                          ? t("verifiedOk")
                          : t("toAnalyze")}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {(selectedRecord.issues?.length ?? 0) > 0 ? (
          <section className="space-y-4">
            <SectionTitle showIndicator={false}>{t("improvementsTitle")}</SectionTitle>
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
                        {t("opportunityNumber", { count: index + 1 })}
                      </p>
                    </div>

                    <Badge
                      className={cn(
                        "h-6 px-2 text-xs font-bold",
                        severityTone(issue.severity),
                      )}
                    >
                      {severityDisplayLabel(issue.severity, t)}
                    </Badge>
                    <Badge variant="outline" className="h-6 px-2 text-xs font-bold">
                      {issueSourceDisplayLabel(issue, t)}
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
          <EmptyStateCard label={t("noPriorityOpportunity")} />
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle showIndicator={false}>{t("extractedContent")}</SectionTitle>
          </div>

          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-background p-4 text-sm leading-6 text-foreground">
            {selectedRecord.markdown?.trim() ||
              t("noMarkdownExtracted")}
          </pre>
        </section>
      </div>
    </div>
  );
}

function CrawlerRecordCard({
  record,
  selected,
  onSelect,
}: {
  record: ContentOptimizerCrawlRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useScopedI18n("crawler-panel");
  const priority = computePriority(record);
  const recordTitle = decodeHTMLText(record.title) || record.url;

  return (
    <button
      type="button"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected && "border-primary bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
            {recordTitle}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {hostnameFromURL(record.url)}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {pathnameFromURL(record.url)}
          </p>
        </div>
        <Badge variant="outline" className="h-6 shrink-0 rounded-sm px-2 text-xs">
          HTTP {record.httpStatus ?? "-"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={statusTone(record.status)}>
          {statusDisplayLabel(record.status, t)}
        </Badge>
        <Badge className={priority.className}>
          {priorityDisplayLabel(priority.rank, t)}
        </Badge>
        <Badge variant="outline">
          {signalCountLabel(record.issues?.length ?? 0, t)}
        </Badge>
      </div>
    </button>
  );
}

export function CrawlerResultsView({
  errorLabel,
  loadingLatest,
  running,
  remainingCount,
  query,
  statusFilter,
  severityFilter,
  sortKey,
  sortDirection,
  records,
  filteredRecords,
  selectedRecord,
  diagnosticsVerified,
  analysisModels,
  selectedAnalysisModelId,
  onSelectedAnalysisModelIdChange,
  analysisRunning,
  canAnalyze,
  onAnalyze,
  onQueryChange,
  onStatusFilterChange,
  onSeverityFilterChange,
  onToggleSort,
  onSelectRecord,
}: CrawlerResultsViewProps) {
  const { t } = useScopedI18n("crawler-panel");
  const [confirmAnalysisOpen, setConfirmAnalysisOpen] = useState(false);
  const selectedAnalysisModel = analysisModels.find((model) => model.id === selectedAnalysisModelId) ?? null;
  const analysisCredits = selectedAnalysisModel?.creditCost ?? 0;
  const statusFilterOptions = [
    { value: "all", label: t("statusAll") },
    { value: "completed", label: t("statusCompleted") },
    { value: "running", label: t("statusRunning") },
    { value: "errored", label: t("statusErrored") },
    { value: "cancelled", label: t("statusCancelled") },
  ] as const satisfies readonly PeriodFilterOption[];
  const severityFilterOptions = [
    { value: "all", label: t("severityAll") },
    { value: "high", label: t("severityHigh") },
    { value: "medium", label: t("severityMedium") },
    { value: "low", label: t("severityLow") },
    { value: "none", label: t("severityNone") },
  ] as const satisfies readonly PeriodFilterOption[];
  const columns = [
    { id: "page", label: t("columnPage"), className: "min-w-[260px]" },
    { id: "url", label: t("columnUrl"), className: "min-w-[260px]" },
    { id: "http", label: t("columnHttp"), className: "w-[88px]" },
    { id: "status", label: t("statusLabel"), className: "w-[120px]" },
    { id: "priority", label: t("columnPriority"), className: "w-[120px]" },
    { id: "findings", label: t("columnSignals"), className: "w-[120px]" },
  ] as const;

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

      <div className="border-b px-3 py-3 md:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2 lg:flex lg:items-center lg:gap-3">
            <div className="relative md:col-span-2 lg:col-span-1 lg:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>

            <PeriodFilterPicker
              className="w-full lg:w-[220px]"
              value={statusFilter}
              onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
              options={statusFilterOptions}
              label={t("statusLabel")}
              title={t("statusLabel")}
            />

            <Select
              value={selectedAnalysisModelId}
              onValueChange={onSelectedAnalysisModelIdChange}
              disabled={analysisModels.length === 0}
            >
              <SelectTrigger className="w-full lg:w-[220px]">
                {selectedAnalysisModel ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <img src={selectedAnalysisModel.icon} alt="" className="size-4 shrink-0 object-contain" />
                    <span className="truncate">{selectedAnalysisModel.name}</span>
                  </span>
                ) : (
                  <SelectValue placeholder={t("selectAnalysisModel")} />
                )}
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {analysisModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex items-center gap-2">
                      <img src={model.icon} alt="" className="size-4 object-contain" />
                      <span>{model.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <PeriodFilterPicker
              className="w-full lg:w-[220px]"
              value={severityFilter}
              onValueChange={(value) =>
                onSeverityFilterChange(value as SeverityFilter)
              }
              options={severityFilterOptions}
              label={t("severityLabel")}
              title={t("severityLabel")}
            />
          </div>

        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_620px]">
        <div className="min-h-0 overflow-auto border-r">
          <div className="space-y-2 p-3 lg:hidden">
            {loadingLatest || (running && filteredRecords.length === 0) ? (
              loadingCards(running ? 1 : 4)
            ) : filteredRecords.length === 0 ? (
              <EmptyStateCard
                label={
                  errorLabel ||
                  (records.length === 0
                    ? t("noResultAvailable")
                    : t("noResultMatchesFilters"))
                }
                className="h-24"
              />
            ) : (
              <>
                {filteredRecords.map((record) => (
                  <CrawlerRecordCard
                    key={record.url}
                    record={record}
                    selected={selectedRecord?.url === record.url}
                    onSelect={() => onSelectRecord(record.url)}
                  />
                ))}
                {running && remainingCount > 0 ? loadingCards(1) : null}
              </>
            )}
          </div>

          <div className="hidden lg:block">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {columns.map((column) => {
                  const sortMap: Partial<Record<(typeof columns)[number]["id"], SortKey>> = {
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
              {loadingLatest || (running && filteredRecords.length === 0) ? (
                loadingRows(running ? 1 : 6)
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
                          ? t("noResultAvailable")
                          : t("noResultMatchesFilters"))
                      }
                      className="h-24"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <>
                {filteredRecords.map((record) => {
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
                            {signalCountLabel(record.issues?.length ?? 0, t)}
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
                          {statusDisplayLabel(record.status, t)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge className={priority.className}>
                          {priorityDisplayLabel(priority.rank, t)}
                        </Badge>
                      </TableCell>

                      <TableCell className="whitespace-normal">
                        <Badge variant="outline">
                          {signalCountLabel(record.issues?.length ?? 0, t)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {running && remainingCount > 0 ? loadingRows(1) : null}
                </>
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        <aside className="hidden min-h-0 overflow-auto bg-background lg:block">
          <CrawlerDetailPane
            selectedRecord={selectedRecord}
            diagnosticsVerified={diagnosticsVerified}
            analysisRunning={analysisRunning}
            canAnalyze={canAnalyze}
            analysisAvailable={Boolean(selectedAnalysisModel)}
            onRequestAnalysis={() => setConfirmAnalysisOpen(true)}
          />
        </aside>
      </div>
      <Dialog open={confirmAnalysisOpen} onOpenChange={setConfirmAnalysisOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDiagnosticAnalysisTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmDiagnosticAnalysisDescription", {
                pages: 1,
                model: selectedAnalysisModel?.name ?? "-",
                credits: analysisCredits,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmAnalysisOpen(false)} disabled={analysisRunning}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={!selectedAnalysisModel || analysisRunning}
              onClick={() => {
                if (!selectedAnalysisModel) return;
                setConfirmAnalysisOpen(false);
                if (!selectedRecord) return;
                void onAnalyze(selectedAnalysisModel, selectedRecord);
              }}
            >
              {t("confirmAndAnalyze", { credits: analysisCredits })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
