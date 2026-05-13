import { AlertCircle, FileText } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
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
import { useContentOptimizerViewModel } from "../../_lib/crawl/use-content-optimizer-view-model";
import type { ContentOptimizerCrawlRecord } from "../../_lib/content-optimizer-api";

type CrawlPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type CrawlColumn = {
  id: string;
  label: string;
  className?: string;
};

const columns: CrawlColumn[] = [
  { id: "page", label: "Page", className: "min-w-[260px]" },
  { id: "url", label: "URL", className: "min-w-[300px]" },
  { id: "http", label: "HTTP", className: "w-[96px]" },
  { id: "status", label: "Statut", className: "w-[140px]" },
  { id: "priority", label: "Priorite", className: "w-[120px]" },
  { id: "issues", label: "Erreurs SEO/GEO", className: "min-w-[260px]" },
  { id: "action", label: "Action recommandee", className: "min-w-[260px]" },
];

function statusTone(status: string): "default" | "outline" | "destructive" | "secondary" {
  if (status === "completed") return "default";
  if (status === "running") return "secondary";
  if (status.includes("cancelled") || status === "errored") return "destructive";
  return "outline";
}

function contentLabel(record: ContentOptimizerCrawlRecord): string {
  if (record.markdown?.trim()) return "Markdown";
  if (record.html?.trim()) return "HTML";
  if (record.json != null) return "JSON";
  return "-";
}

function pageContent(record: ContentOptimizerCrawlRecord): string {
  if (record.markdown?.trim()) return record.markdown.trim();
  if (record.html?.trim()) return record.html.trim();
  if (record.json != null) return JSON.stringify(record.json, null, 2);
  return "Aucun contenu extrait pour cette page.";
}

function severityTone(severity: string): string {
  if (severity === "high") return "border-transparent bg-rose-100 text-rose-800";
  if (severity === "medium") return "border-transparent bg-amber-100 text-amber-800";
  if (severity === "low") return "border-transparent bg-sky-100 text-sky-800";
  return "";
}

function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function primaryIssue(record: ContentOptimizerCrawlRecord) {
  return [...(record.issues ?? [])].sort(
    (left, right) => severityRank(right.severity) - severityRank(left.severity),
  )[0] ?? null;
}

function totalIssueCount(records: ContentOptimizerCrawlRecord[]): number {
  return records.reduce((total, record) => total + (record.issues?.length ?? 0), 0);
}

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
        <Skeleton className="h-4 w-full max-w-[420px]" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
    </TableRow>
  ));
}

export function CrawlPanel({ apiBaseURL, routeSearch }: CrawlPanelProps) {
  const viewModel = useContentOptimizerViewModel({ apiBaseURL, routeSearch });
  const records = viewModel.crawlRecords;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Content optimizer"
        baseline="Resultats du dernier crawl avec erreurs SEO/GEO et actions recommandees."
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="default">{records.length} pages</Badge>
            <Badge variant="outline">{totalIssueCount(records)} erreurs</Badge>
            {viewModel.crawlResult?.status ? (
              <Badge variant={statusTone(viewModel.crawlResult.status)}>
                {viewModel.crawlResult.status}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-md rounded-tr-none bg-background">
        {viewModel.error ? (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{viewModel.error}</span>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    className={cn(
                      "h-12 px-3 text-sm font-semibold text-muted-foreground",
                      column.className,
                    )}
                    key={column.id}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:px-3 [&_td]:py-3">
              {viewModel.loadingLatest ? (
                loadingRows()
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-4">
                    <EmptyStateCard label="Aucun resultat de crawl enregistre." className="h-20" />
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow
                    className="cursor-pointer"
                    data-state={viewModel.selectedResult?.url === record.url ? "selected" : undefined}
                    key={record.url}
                    onClick={() => viewModel.setSelectedResultURL(record.url)}
                  >
                    <TableCell className="max-w-[360px] whitespace-normal">
                      <div className="line-clamp-2 text-sm font-medium leading-6">
                        {record.title || record.url}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[520px] truncate text-muted-foreground">
                      {record.url}
                    </TableCell>
                    <TableCell>{record.httpStatus ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(record.status)}>{record.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {primaryIssue(record) ? (
                        <Badge className={severityTone(primaryIssue(record)?.severity ?? "")}>
                          {primaryIssue(record)?.severity}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[340px] whitespace-normal">
                      {primaryIssue(record) ? (
                        <div className="space-y-1">
                          <div className="line-clamp-1 text-sm font-medium">
                            {primaryIssue(record)?.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(record.issues?.length ?? 0)} erreur(s) · {contentLabel(record)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Aucune erreur detectee</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal">
                      <div className="line-clamp-2 text-sm text-foreground">
                        {primaryIssue(record)?.recommendation ?? "Aucune action requise"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {viewModel.selectedResult ? (
            <div className="mt-4 rounded-md border border-border bg-muted/20">
              <div className="border-b border-border px-4 py-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {viewModel.selectedResult.title || viewModel.selectedResult.url}
                    </h3>
                    <p className="break-all text-xs text-muted-foreground">
                      {viewModel.selectedResult.url}
                    </p>
                  </div>
                  <Badge variant={statusTone(viewModel.selectedResult.status)}>
                    {viewModel.selectedResult.status}
                  </Badge>
                </div>
              </div>

              {viewModel.selectedResult.issues?.length ? (
                <div className="grid gap-2 border-b border-border p-4 lg:grid-cols-2">
                  {viewModel.selectedResult.issues.map((issue) => (
                    <div key={issue.id} className="rounded-md border border-border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{issue.title}</span>
                        <Badge className={severityTone(issue.severity)}>{issue.severity}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {issue.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contenu extrait
                </div>
                <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm leading-6 text-foreground">
                  {pageContent(viewModel.selectedResult)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
