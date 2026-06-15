import { Table2, Workflow } from "lucide-react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PanelToolbar } from "../shared/panel-toolbar";
import type { ModelVisual, PromptRunRow, ResponseView } from "../../_lib/types";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import {
  EmptyResponsesState,
  ResponseCompetitorsCell,
  ResponseFilterToggle,
  formatCompetitorSummary,
  virtuosoTableComponents,
} from "./responses-shared";

type ResponseColumn = {
  id: string;
  label: string;
  className?: string;
};

function mentionBadgeClassName(mentioned: boolean) {
  return mentioned ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
}

function resultBadgeClassName(hasError: boolean) {
  return hasError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700";
}

function historicalBadgeClassName() {
  return "bg-muted text-muted-foreground";
}

function competitorBadgeClassName() {
  return "bg-secondary text-background";
}

function sentimentBadgeClassName(sentiment: PromptRunRow["sentiment"]) {
  if (sentiment === "positive") return "bg-emerald-50 text-emerald-700";
  if (sentiment === "negative") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

function sentimentLabel(
  sentiment: PromptRunRow["sentiment"],
  content: Record<string, string>,
) {
  if (sentiment === "positive") return content.sentimentPositive;
  if (sentiment === "negative") return content.sentimentNegative;
  return content.sentimentNeutral;
}

function ResponseTableLoadingRows() {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-md border bg-background p-3 lg:grid-cols-[110px_160px_minmax(220px,1fr)_90px_110px_70px_150px_80px]"
        >
          <Skeleton className="h-6 w-full rounded-full" />
          <Skeleton className="h-6 w-full rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-6 w-full rounded-full" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function ResponseTimelineLoadingRows() {
  return (
    <div className="space-y-3 py-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-md border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

type ResponsesViewProps = {
  noMentionOnly: boolean;
  setNoMentionOnly: (value: boolean) => void;
  showHistorical: boolean;
  setShowHistorical: (value: boolean) => void;
  loading?: boolean;
  viewMode: ResponseView;
  setViewMode: (value: ResponseView) => void;
  filteredResponses: PromptRunRow[];
  filteredResponsesTotal: number;
  hasMoreResponses: boolean;
  loadMoreResponses: () => void;
  setSelectedResponseId: (id: string | null) => void;
  getModelVisual: (model: string) => ModelVisual;
  rankTone: (rank: number) => string;
  truncate: (value: string, max?: number) => string;
};

export function ResponsesContent(props: ResponsesViewProps) {
  const content = useI18nScope("prompts-workspace");
  const handleEndReached = () => props.hasMoreResponses && props.loadMoreResponses();
  const responsesColumns: ResponseColumn[] = [
    { id: "time", label: content.time },
    { id: "ai", label: content.ai },
    { id: "prompt", label: content.prompt },
    { id: "mention", label: content.mention },
    { id: "sentiment", label: content.sentiment },
    { id: "rank", label: content.rank },
    { id: "competitor", label: content.competitor },
    { id: "score", label: content.score },
  ] as const;

  return (
    <>
      <PanelToolbar
        summary={
          props.loading ? (
            <Skeleton className="h-9 w-36 rounded-full" />
          ) : (
            <Badge variant="outline" className="h-9 justify-center px-3 text-sm">
              {props.filteredResponses.length} / {props.filteredResponsesTotal} {content.responsesCount}
            </Badge>
          )
        }
      >
          <div className="flex flex-wrap items-center gap-2">
            <ResponseFilterToggle
              label={content.withoutMention}
              tone="rose"
              active={props.noMentionOnly}
              onToggle={() => props.setNoMentionOnly(!props.noMentionOnly)}
            />
            <ResponseFilterToggle
              label={content.history}
              tone="neutral"
              active={props.showHistorical}
              onToggle={() => props.setShowHistorical(!props.showHistorical)}
            />
          </div>

            <div className="flex h-10 w-full gap-1 rounded-xl border p-1 sm:w-auto">
              <Button size="sm" variant={props.viewMode === "timeline" ? "default" : "ghost"} className="h-8 flex-1 rounded-lg px-3 text-sm sm:flex-none" onClick={() => props.setViewMode("timeline")}>
                <Workflow className="mr-1.5 h-4 w-4" />
                {content.timeline}
              </Button>
              <Button size="sm" variant={props.viewMode === "table" ? "default" : "ghost"} className="h-8 flex-1 rounded-lg px-3 text-sm sm:flex-none" onClick={() => props.setViewMode("table")}>
                <Table2 className="mr-1.5 h-4 w-4" />
                {content.table}
              </Button>
            </div>
      </PanelToolbar>

      <div className="min-h-0 flex-1 px-4">
        {props.loading ? (
          props.viewMode === "table" ? (
            <ResponseTableLoadingRows />
          ) : (
            <ResponseTimelineLoadingRows />
          )
        ) : props.viewMode === "table" ? (
          props.filteredResponses.length === 0 ? (
            <EmptyResponsesState />
          ) : (
            <TableVirtuoso
              style={{ height: "100%" }}
              data={props.filteredResponses}
              computeItemKey={(_, item) => item.id}
              defaultItemHeight={82}
              endReached={handleEndReached}
              increaseViewportBy={{ top: 96, bottom: 160 }}
              fixedHeaderContent={() => (
                <tr>
                  {responsesColumns.map((column) => (
                    <TableHead key={column.id} className={cn("h-12 bg-background px-3 text-sm font-semibold text-muted-foreground", column.className)}>
                      {column.label}
                    </TableHead>
                  ))}
                </tr>
              )}
              itemContent={(_, item) => {
                const modelVisual = props.getModelVisual(item.model);
                const openResponse = () => props.setSelectedResponseId(item.id);
                const cellClassName = "cursor-pointer";

                return (
                  <>
                    <TableCell className={cellClassName} onClick={openResponse}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
                        {item.time}
                      </span>
                    </TableCell>
                    <TableCell className={cellClassName} onClick={openResponse}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
                          <img src={modelVisual.icon} alt={item.model} className="h-4 w-4" decoding="async" />
                          {modelVisual.name}
                        </span>
                        {item.isHistorical ? <Badge variant="outline" className="text-sm font-normal">{content.history}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className={cn("min-w-[280px] max-w-[360px]", cellClassName)} onClick={openResponse}>
                      <div className="line-clamp-2 text-sm font-medium leading-6">{props.truncate(item.prompt, 96)}</div>
                    </TableCell>
                    <TableCell className={cellClassName} onClick={openResponse}>
                      <Badge variant="secondary" className={cn("border-transparent text-sm", mentionBadgeClassName(item.mention))}>
                        {item.mention ? content.mentioned : content.missing}
                      </Badge>
                    </TableCell>
                    <TableCell className={cellClassName} onClick={openResponse}>
                      <Badge
                        variant="secondary"
                        className={cn("border-transparent text-sm", sentimentBadgeClassName(item.sentiment))}
                      >
                        {sentimentLabel(item.sentiment, content)}
                      </Badge>
                    </TableCell>
                    <TableCell className={cellClassName} onClick={openResponse}>
                      {item.rank ? (
                        <Badge className={cn("text-sm", props.rankTone(item.rank))}>#{item.rank}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className={cellClassName} onClick={openResponse}><ResponseCompetitorsCell competitors={item.competitors} /></TableCell>
                    <TableCell className={cellClassName} onClick={openResponse}>
                      <div className="w-20">
                        <div className="text-sm font-medium">{item.score}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div className={cn("h-1.5 rounded-full", item.score >= 80 ? "bg-emerald-500" : item.score >= 50 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${item.score}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </>
                );
              }}
              components={virtuosoTableComponents}
            />
          )
        ) : props.filteredResponses.length === 0 ? (
          <EmptyResponsesState />
        ) : (
          <Virtuoso
            style={{ height: "100%" }}
            data={props.filteredResponses}
            computeItemKey={(_, item) => item.id}
            defaultItemHeight={92}
            endReached={handleEndReached}
            increaseViewportBy={{ top: 96, bottom: 160 }}
            itemContent={(_, item) => {
              const modelVisual = props.getModelVisual(item.model);

              return (
                <div className="py-3">
                  <button
                    type="button"
                    onClick={() => props.setSelectedResponseId(item.id)}
                    className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <span>{item.time} ·</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
                          <img src={modelVisual.icon} alt={item.model} className="h-4 w-4" decoding="async" />
                          {modelVisual.name}
                        </span>
                        {modelVisual.provider && modelVisual.provider !== modelVisual.name && (
                          <span className="text-sm text-muted-foreground">{modelVisual.provider}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isHistorical ? (
                          <Badge variant="secondary" className={historicalBadgeClassName()}>
                            {content.history}
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className={resultBadgeClassName(Boolean(item.error))}>
                          {item.error ? content.error : content.ok}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm">{props.truncate(item.prompt, 80)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className={mentionBadgeClassName(item.mention)}>
                        {item.mention ? content.mentioned : content.missing}
                      </Badge>
                      <Badge variant="secondary" className={sentimentBadgeClassName(item.sentiment)}>
                        {sentimentLabel(item.sentiment, content)}
                      </Badge>
                      {item.rank ? <Badge className={props.rankTone(item.rank)}>#{item.rank}</Badge> : null}
                      <Badge variant="secondary" className={competitorBadgeClassName()}>
                        {formatCompetitorSummary(item.competitors, content.noCompetitor)}
                      </Badge>
                    </div>
                  </button>
                </div>
              );
            }}
          />
        )}
      </div>
    </>
  );
}
