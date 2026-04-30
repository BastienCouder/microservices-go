import { useState } from "react";
import { ChevronDown, Table2, Timer, Workflow } from "lucide-react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead } from "@/components/ui/table";
import { PanelToolbar } from "../shared/panel-toolbar";
import type { ModelVisual, PromptRunRow, ResponseView } from "../../_lib/types";
import { cn } from "@/lib/utils";
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

function ResponseTableLoadingRows() {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-md border bg-background p-3 lg:grid-cols-[110px_160px_minmax(220px,1fr)_90px_70px_150px_80px]"
        >
          <Skeleton className="h-6 w-full rounded-full" />
          <Skeleton className="h-6 w-full rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
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
  selectedCompetitors: string[];
  toggleCompetitor: (value: string) => void;
  clearCompetitors: () => void;
  availableCompetitors: string[];
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
  const [competitorFilterOpen, setCompetitorFilterOpen] = useState(false);
  const handleEndReached = () => props.hasMoreResponses && props.loadMoreResponses();
  const selectedCompetitorLabel =
    props.selectedCompetitors.length === 0
      ? content.allCompetitors
      : props.selectedCompetitors.length === 1
        ? props.selectedCompetitors[0]!
        : `${props.selectedCompetitors.length} ${content.competitorsSelected}`;
  const responsesColumns: ResponseColumn[] = [
    { id: "time", label: content.time },
    { id: "ai", label: content.ai },
    { id: "prompt", label: content.prompt },
    { id: "mention", label: content.mention },
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
            <Popover open={competitorFilterOpen} onOpenChange={setCompetitorFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-between rounded-full border-border/80 bg-background px-4 text-sm sm:w-auto sm:min-w-[240px] sm:max-w-[360px]"
                  title={selectedCompetitorLabel}
                >
                  <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
                    <span className="shrink-0 text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {content.competitors}
                    </span>
                    <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    {props.loading ? (
                      <Skeleton className="h-4 w-24 rounded-full" />
                    ) : (
                      <span className="truncate text-sm font-medium text-foreground">
                        {selectedCompetitorLabel}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[560px] max-w-[92vw] p-0">
                <FloatingPanelHeader
                  title={content.topCompetitorsTitle}
                  description={content.topCompetitorsDescription}
                />
                <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      props.clearCompetitors();
                    }}
                    className={cn(
                      "cursor-pointer relative flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                      props.selectedCompetitors.length === 0
                        ? "border-primary/30 bg-primary/10"
                        : "border-border/70 bg-background hover:bg-muted/30",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate text-sm font-semibold leading-tight",
                          props.selectedCompetitors.length === 0 ? "text-primary" : "text-foreground",
                        )}
                      >
                        {content.allCompetitors}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "ml-auto mt-1 h-2.5 w-2.5 rounded-full",
                        props.selectedCompetitors.length === 0 ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    />
                  </button>
                  {props.loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="relative flex items-start gap-2 rounded-2xl border border-border/70 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="ml-auto mt-1 h-2.5 w-2.5 rounded-full" />
                      </div>
                    ))
                  ) : (
                    props.availableCompetitors.map((item) => {
                      const highlighted = props.selectedCompetitors.includes(item);

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            props.toggleCompetitor(item);
                          }}
                          className={cn(
                            "cursor-pointer relative flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                            highlighted
                              ? "border-primary/30 bg-primary/10"
                              : "border-border/70 bg-background hover:bg-muted/30",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={cn("truncate text-sm font-semibold leading-tight", highlighted ? "text-primary" : "text-foreground")}>{item}</div>
                          </div>
                          <div
                            className={cn(
                              "ml-auto mt-1 h-2.5 w-2.5 rounded-full",
                              highlighted ? "bg-primary" : "bg-muted-foreground/30",
                            )}
                          />
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

            <div className="flex h-10 w-full gap-1 rounded-full border p-1 sm:w-auto">
              <Button size="sm" variant={props.viewMode === "timeline" ? "default" : "ghost"} className="h-8 flex-1 rounded-full px-3 text-sm sm:flex-none" onClick={() => props.setViewMode("timeline")}>
                <Workflow className="mr-1.5 h-4 w-4" />
                {content.timeline}
              </Button>
              <Button size="sm" variant={props.viewMode === "table" ? "default" : "ghost"} className="h-8 flex-1 rounded-full px-3 text-sm sm:flex-none" onClick={() => props.setViewMode("table")}>
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
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        {item.time}
                      </span>
                    </TableCell>
                    <TableCell className={cellClassName} onClick={openResponse}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
                          <img src={modelVisual.icon} alt={item.model} className="h-4 w-4" decoding="async" />
                          {modelVisual.label}
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
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        <span>{item.time} ·</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
                          <img src={modelVisual.icon} alt={item.model} className="h-4 w-4" decoding="async" />
                          {modelVisual.label}  
                        </span>
                        {item.model !== modelVisual.label && (
                          <span className="text-sm text-muted-foreground">{item.model}</span>
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
