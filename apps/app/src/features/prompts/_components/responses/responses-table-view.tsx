import { useState } from "react";
import { ChevronDown, Table2, Timer, Workflow } from "lucide-react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableCell, TableHead } from "@/components/ui/table";
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

type ResponsesViewProps = {
  onlyErrors: boolean;
  setOnlyErrors: (value: boolean) => void;
  criticalOnly: boolean;
  setCriticalOnly: (value: boolean) => void;
  noMentionOnly: boolean;
  setNoMentionOnly: (value: boolean) => void;
  showHistorical: boolean;
  setShowHistorical: (value: boolean) => void;
  selectedCompetitors: string[];
  toggleCompetitor: (value: string) => void;
  clearCompetitors: () => void;
  availableCompetitors: string[];
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
    { id: "error", label: content.error },
    { id: "action", label: content.action, className: "text-right" },
  ] as const;

  return (
    <>
      <div className="border-b  px-4 pt-2 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Badge variant="outline" className="h-9 justify-center px-3 sm:h-7">
            {props.filteredResponses.length} / {props.filteredResponsesTotal} {content.responsesCount}
          </Badge>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex flex-wrap items-center gap-2">
              <ResponseFilterToggle
                label={content.errors}
                tone="amber"
                active={props.onlyErrors}
                onToggle={() => props.setOnlyErrors(!props.onlyErrors)}
              />
              <ResponseFilterToggle
                label={content.critical}
                tone="rose"
                active={props.criticalOnly}
                onToggle={() => props.setCriticalOnly(!props.criticalOnly)}
              />
              <ResponseFilterToggle
                label={content.withoutMention}
                tone="emerald"
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
                    className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[240px] sm:max-w-[360px]"
                    title={selectedCompetitorLabel}
                  >
                    <span className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {content.competitors}
                      </span>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {selectedCompetitorLabel}
                      </span>
                    </span>
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
                    {props.availableCompetitors.map((item) => {
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
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex w-full gap-1 rounded-full border p-1 sm:w-auto">
              <Button size="sm" variant={props.viewMode === "timeline" ? "default" : "ghost"} className="h-9 flex-1 rounded-full px-3 sm:h-7 sm:flex-none sm:px-2" onClick={() => props.setViewMode("timeline")}>
                <Workflow className="mr-1 h-3.5 w-3.5" />
                {content.timeline}
              </Button>
              <Button size="sm" variant={props.viewMode === "table" ? "default" : "ghost"} className="h-9 flex-1 rounded-full px-3 sm:h-7 sm:flex-none sm:px-2" onClick={() => props.setViewMode("table")}>
                <Table2 className="mr-1 h-3.5 w-3.5" />
                {content.table}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4">
        {props.viewMode === "table" ? (
          props.filteredResponses.length === 0 ? (
            <EmptyResponsesState />
          ) : (
            <TableVirtuoso
              style={{ height: "100%" }}
              data={props.filteredResponses}
              computeItemKey={(_, item) => item.id}
              defaultItemHeight={74}
              endReached={handleEndReached}
              increaseViewportBy={{ top: 96, bottom: 160 }}
              fixedHeaderContent={() => (
                <tr>
                  {responsesColumns.map((column) => (
                    <TableHead key={column.id} className={cn("bg-background", column.className)}>
                      {column.label}
                    </TableHead>
                  ))}
                </tr>
              )}
              itemContent={(_, item) => {
                const modelVisual = props.getModelVisual(item.model);

                return (
                  <>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.time}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                          <img src={modelVisual.icon} alt={item.model} className="h-3 w-3" decoding="async" />
                          {modelVisual.label}
                        </span>
                        {item.isHistorical ? <Badge variant="outline" className="font-normal">{content.history}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[280px] max-w-[360px]">
                      <div className="line-clamp-2 font-medium leading-6">{props.truncate(item.prompt, 96)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={mentionBadgeClassName(item.mention)}>
                        {item.mention ? content.mentioned : content.missing}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.rank ? (
                        <Badge className={props.rankTone(item.rank)}>#{item.rank}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell><ResponseCompetitorsCell competitors={item.competitors} /></TableCell>
                    <TableCell>
                      <div className="w-20">
                        <div className="text-xs font-medium">{item.score}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div className={cn("h-1.5 rounded-full", item.score >= 80 ? "bg-emerald-500" : item.score >= 50 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${item.score}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.error ? (
                        <Badge variant="destructive" className="font-normal">
                          {item.error}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          {content.noError}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => props.setSelectedResponseId(item.id)}>{content.view}</Button>
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
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
                          <img src={modelVisual.icon} alt={item.model} className="h-3 w-3" decoding="async" />
                          {modelVisual.label}  
                        </span>
                        {item.model !== modelVisual.label && (
                          <span className="text-xs text-muted-foreground">{item.model}</span>
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
