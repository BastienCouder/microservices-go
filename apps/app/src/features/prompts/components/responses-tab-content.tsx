import { forwardRef, type ComponentProps } from "react";
import { Table2, Timer, Workflow } from "lucide-react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableHead } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ModelVisual, PromptRunRow, ResponseView } from "./types";
import { cn } from "@/lib/utils";

type ResponsesTabContentProps = {
  onlyErrors: boolean;
  setOnlyErrors: (value: boolean) => void;
  criticalOnly: boolean;
  setCriticalOnly: (value: boolean) => void;
  noMentionOnly: boolean;
  setNoMentionOnly: (value: boolean) => void;
  showHistorical: boolean;
  setShowHistorical: (value: boolean) => void;
  topCompetitor: string;
  setTopCompetitor: (value: string) => void;
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

type ResponseColumn = {
  id: string;
  label: string;
  className?: string;
};

export function ResponsesTabContent({
  onlyErrors,
  setOnlyErrors,
  criticalOnly,
  setCriticalOnly,
  noMentionOnly,
  setNoMentionOnly,
  showHistorical,
  setShowHistorical,
  topCompetitor,
  setTopCompetitor,
  availableCompetitors,
  viewMode,
  setViewMode,
  filteredResponses,
  filteredResponsesTotal,
  hasMoreResponses,
  loadMoreResponses,
  setSelectedResponseId,
  getModelVisual,
  rankTone,
  truncate,
}: ResponsesTabContentProps) {
  const handleEndReached = () => {
    if (hasMoreResponses) {
      loadMoreResponses();
    }
  };

  const responsesColumns: ResponseColumn[] = [
    { id: "time", label: "Heure" },
    { id: "ai", label: "IA" },
    { id: "prompt", label: "Prompt" },
    { id: "mention", label: "Mention" },
    { id: "rank", label: "Classement" },
    { id: "competitor", label: "Concurrent" },
    { id: "score", label: "Score" },
    { id: "error", label: "Erreur" },
    { id: "action", label: "Action", className: "text-right" },
  ] as const;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="m-0 flex min-h-0 flex-1 flex-col">
        <div className="border-b  px-4 pt-2 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Badge variant="outline" className="h-9 justify-center px-3 sm:h-7">
                {filteredResponses.length} / {filteredResponsesTotal} reponses
              </Badge>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                <ResponseFilterToggle label="Erreurs" active={onlyErrors} onToggle={() => setOnlyErrors(!onlyErrors)} />
                <ResponseFilterToggle label="Critiques" active={criticalOnly} onToggle={() => setCriticalOnly(!criticalOnly)} />
                <ResponseFilterToggle label="Sans mention" active={noMentionOnly} onToggle={() => setNoMentionOnly(!noMentionOnly)} />
                <ResponseFilterToggle label="Historique" active={showHistorical} onToggle={() => setShowHistorical(!showHistorical)} />
                <Select value={topCompetitor} onValueChange={setTopCompetitor}>
                  <SelectTrigger className="h-10 w-full min-w-[200px] sm:h-8 sm:w-[180px]">
                    <SelectValue placeholder="Concurrents principaux" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Concurrents principaux</SelectItem>
                    {availableCompetitors.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-full gap-1 rounded-full border p-1 sm:w-auto">
                <Button size="sm" variant={viewMode === "timeline" ? "default" : "ghost"} className="h-9 flex-1 rounded-full px-3 sm:h-7 sm:flex-none sm:px-2" onClick={() => setViewMode("timeline")}>
                  <Workflow className="mr-1 h-3.5 w-3.5" />
                  Chronologie
                </Button>
                <Button size="sm" variant={viewMode === "table" ? "default" : "ghost"} className="h-9 flex-1 rounded-full px-3 sm:h-7 sm:flex-none sm:px-2" onClick={() => setViewMode("table")}>
                  <Table2 className="mr-1 h-3.5 w-3.5" />
                  Tableau
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 px-4">
          {viewMode === "table" ? (
            filteredResponses.length === 0 ? (
              <EmptyResponsesState />
            ) : (
              <TableVirtuoso
                style={{ height: "100%" }}
                data={filteredResponses}
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
                  const modelVisual = getModelVisual(item.model);

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
                          {item.isHistorical ? (
                            <Badge variant="outline" className="font-normal">
                              Historique
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[280px] max-w-[360px]">
                        <div className="line-clamp-2 font-medium leading-6">{truncate(item.prompt, 96)}</div>
                        {item.persona ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">{item.persona}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.mention ? "secondary" : "destructive"}>{item.mention ? "Mentionnee" : "Absente"}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.rank ? (
                          <Badge className={rankTone(item.rank)}>#{item.rank}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ResponseCompetitorsCell competitors={item.competitors} />
                      </TableCell>
                      <TableCell>
                        <div className="w-20">
                          <div className="text-xs font-medium">{item.score}</div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-1.5 rounded-full",
                                item.score >= 80 ? "bg-emerald-500" : item.score >= 50 ? "bg-amber-500" : "bg-rose-500",
                              )}
                              style={{ width: `${item.score}%` }}
                            />
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
                            Aucune erreur
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedResponseId(item.id)}>
                          Voir
                        </Button>
                      </TableCell>
                    </>
                  );
                }}
                components={virtuosoTableComponents}
              />
            )
          ) : (
            filteredResponses.length === 0 ? (
              <EmptyResponsesState />
            ) : (
              <Virtuoso
                style={{ height: "100%" }}
                data={filteredResponses}
                computeItemKey={(_, item) => item.id}
                defaultItemHeight={92}
                endReached={handleEndReached}
                increaseViewportBy={{ top: 96, bottom: 160 }}
                itemContent={(_, item) => (
                  <div className="pb-3">
                    <button
                      type="button"
                      onClick={() => setSelectedResponseId(item.id)}
                      className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-medium">
                          <Timer className="h-4 w-4 text-muted-foreground" />
                          {item.time} · {item.model}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.isHistorical ? (
                            <Badge variant="outline" className="font-normal">
                              Historique
                            </Badge>
                          ) : null}
                          <Badge variant={item.error ? "destructive" : "secondary"}>{item.error ? "Erreur" : "OK"}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-sm">{truncate(item.prompt, 80)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mention : {item.mention ? "Oui" : "Non"} · Classement : {item.rank ?? "-"} · Concurrent : {formatCompetitorSummary(item.competitors)}
                      </p>
                    </button>
                  </div>
                )}
              />
            )
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

const virtuosoTableComponents = {
  Scroller: forwardRef<HTMLDivElement, ComponentProps<"div">>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("h-full overflow-auto [contain:strict]", className)} {...props} />
  )),
  Table: ({ className, ...props }: ComponentProps<"table">) => (
    <table className={cn("w-full min-w-[980px] caption-bottom text-sm", className)} {...props} />
  ),
  TableHead: forwardRef<HTMLTableSectionElement, ComponentProps<"thead">>(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  )),
  TableBody: forwardRef<HTMLTableSectionElement, ComponentProps<"tbody">>(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )),
  TableRow: ({ className, ...props }: ComponentProps<"tr">) => (
    <tr className={cn("hover:bg-muted/50 border-b transition-colors", className)} {...props} />
  ),
};

function ResponseFilterToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        "h-8 rounded-full px-3 text-xs sm:h-7 sm:px-2.5",
        active ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background hover:bg-muted/20",
      )}
      onClick={onToggle}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-primary/50",
          active ? "bg-primary/12" : "bg-transparent",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      {label}
    </Button>
  );
}

function ResponseCompetitorsCell({ competitors }: { competitors: string[] }) {
  const visibleCompetitor = competitors[0] || "Aucun";
  const hiddenCompetitors = competitors.slice(1);

  if (hiddenCompetitors.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
        {visibleCompetitor}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
        {visibleCompetitor}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/70 bg-background px-2 text-[11px] font-medium text-muted-foreground"
            aria-label={`${hiddenCompetitors.length} concurrents supplementaires`}
          >
            +{hiddenCompetitors.length}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-sm">
          <div className="space-y-1">
            {hiddenCompetitors.map((competitor) => (
              <div key={competitor}>{competitor}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function formatCompetitorSummary(competitors: string[]) {
  if (competitors.length === 0) return "Aucun";
  if (competitors.length === 1) return competitors[0]!;
  return `${competitors[0]} +${competitors.length - 1}`;
}

function EmptyResponsesState() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-sm text-muted-foreground">
      Aucune reponse pour les filtres selectionnes.
    </div>
  );
}
