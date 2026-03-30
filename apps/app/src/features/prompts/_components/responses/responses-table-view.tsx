import { Table2, Timer, Workflow } from "lucide-react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableHead } from "@/components/ui/table";
import type { ModelVisual, PromptRunRow, ResponseView } from "../../_lib/types";
import { cn } from "@/lib/utils";
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

type ResponsesViewProps = {
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

export function ResponsesContent(props: ResponsesViewProps) {
  const handleEndReached = () => props.hasMoreResponses && props.loadMoreResponses();
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
    <>
      <div className="border-b  px-4 pt-2 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Badge variant="outline" className="h-9 justify-center px-3 sm:h-7">
            {props.filteredResponses.length} / {props.filteredResponsesTotal} reponses
          </Badge>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex flex-wrap items-center gap-2">
              <ResponseFilterToggle label="Erreurs" active={props.onlyErrors} onToggle={() => props.setOnlyErrors(!props.onlyErrors)} />
              <ResponseFilterToggle label="Critiques" active={props.criticalOnly} onToggle={() => props.setCriticalOnly(!props.criticalOnly)} />
              <ResponseFilterToggle label="Sans mention" active={props.noMentionOnly} onToggle={() => props.setNoMentionOnly(!props.noMentionOnly)} />
              <ResponseFilterToggle label="Historique" active={props.showHistorical} onToggle={() => props.setShowHistorical(!props.showHistorical)} />
              <Select value={props.topCompetitor} onValueChange={props.setTopCompetitor}>
                <SelectTrigger className="h-10 w-full min-w-[200px] sm:h-8 sm:w-[180px]">
                  <SelectValue placeholder="Concurrents principaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Concurrents principaux</SelectItem>
                  {props.availableCompetitors.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-full gap-1 rounded-full border p-1 sm:w-auto">
              <Button size="sm" variant={props.viewMode === "timeline" ? "default" : "ghost"} className="h-9 flex-1 rounded-full px-3 sm:h-7 sm:flex-none sm:px-2" onClick={() => props.setViewMode("timeline")}>
                <Workflow className="mr-1 h-3.5 w-3.5" />
                Chronologie
              </Button>
              <Button size="sm" variant={props.viewMode === "table" ? "default" : "ghost"} className="h-9 flex-1 rounded-full px-3 sm:h-7 sm:flex-none sm:px-2" onClick={() => props.setViewMode("table")}>
                <Table2 className="mr-1 h-3.5 w-3.5" />
                Tableau
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
                        {item.isHistorical ? <Badge variant="outline" className="font-normal">Historique</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[280px] max-w-[360px]">
                      <div className="line-clamp-2 font-medium leading-6">{props.truncate(item.prompt, 96)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.mention ? "secondary" : "destructive"}>{item.mention ? "Mentionnee" : "Absente"}</Badge>
                    </TableCell>
                    <TableCell>{item.rank ? <Badge className={props.rankTone(item.rank)}>#{item.rank}</Badge> : <span className="text-muted-foreground">-</span>}</TableCell>
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
                      {item.error ? <Badge variant="destructive" className="font-normal">{item.error}</Badge> : <Badge variant="outline" className="font-normal">Aucune erreur</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => props.setSelectedResponseId(item.id)}>Voir</Button>
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
            itemContent={(_, item) => (
              <div className="pb-3">
                <button
                  type="button"
                  onClick={() => props.setSelectedResponseId(item.id)}
                  className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      {item.time} · {item.model}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.isHistorical ? <Badge variant="outline" className="font-normal">Historique</Badge> : null}
                      <Badge variant={item.error ? "destructive" : "secondary"}>{item.error ? "Erreur" : "OK"}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm">{props.truncate(item.prompt, 80)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mention : {item.mention ? "Oui" : "Non"} · Classement : {item.rank ?? "-"} · Concurrent : {formatCompetitorSummary(item.competitors)}
                  </p>
                </button>
              </div>
            )}
          />
        )}
      </div>
    </>
  );
}
