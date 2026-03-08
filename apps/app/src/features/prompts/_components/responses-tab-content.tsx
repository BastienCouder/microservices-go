import type { UIEvent } from "react";
import { Table2, Timer, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { WorkspaceTable, WorkspaceTableColumn } from "./workspace-table";
import { ModelVisual, PromptRunRow, ResponseView } from "./types";
import { cn } from "@/lib/utils";

type ResponsesTabContentProps = {
  onlyErrors: boolean;
  setOnlyErrors: (value: boolean) => void;
  criticalOnly: boolean;
  setCriticalOnly: (value: boolean) => void;
  noMentionOnly: boolean;
  setNoMentionOnly: (value: boolean) => void;
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

export function ResponsesTabContent({
  onlyErrors,
  setOnlyErrors,
  criticalOnly,
  setCriticalOnly,
  noMentionOnly,
  setNoMentionOnly,
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
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining <= 160 && hasMoreResponses) {
      loadMoreResponses();
    }
  };

  const responsesColumns: WorkspaceTableColumn[] = [
    { id: "time", label: "Heure" },
    { id: "ai", label: "AI" },
    { id: "prompt", label: "Prompt" },
    { id: "mention", label: "Mention" },
    { id: "rank", label: "Rank" },
    { id: "competitor", label: "Competitor" },
    { id: "score", label: "Score" },
    { id: "error", label: "Error" },
    { id: "action", label: "Action", className: "text-right" },
  ];

  return (
    <div className="m-0 flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-10 rounded-full px-4 sm:h-8" variant={onlyErrors ? "default" : "outline"} onClick={() => setOnlyErrors(!onlyErrors)}>
              Errors only
            </Button>
            <Button size="sm" className="h-10 rounded-full px-4 sm:h-8" variant={criticalOnly ? "default" : "outline"} onClick={() => setCriticalOnly(!criticalOnly)}>
              Critical
            </Button>
            <Button size="sm" className="h-10 rounded-full px-4 sm:h-8" variant={noMentionOnly ? "default" : "outline"} onClick={() => setNoMentionOnly(!noMentionOnly)}>
              No mention
            </Button>
            <Select value={topCompetitor} onValueChange={setTopCompetitor}>
              <SelectTrigger className="h-10 w-full min-w-[200px] sm:h-8 sm:w-[180px]">
                <SelectValue placeholder="Top competitors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Top competitors</SelectItem>
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
              Timeline
            </Button>
            <Button size="sm" variant={viewMode === "table" ? "default" : "ghost"} className="h-9 flex-1 rounded-full px-3 sm:h-7 sm:flex-none sm:px-2" onClick={() => setViewMode("table")}>
              <Table2 className="mr-1 h-3.5 w-3.5" />
              Table
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-4 py-3 md:px-6" onScroll={handleScroll}>
        {viewMode === "table" ? (
          <div className="space-y-3">
            <WorkspaceTable
              tableClassName="min-w-[980px]"
              columns={responsesColumns}
              rows={filteredResponses}
              getRowKey={(item) => item.id}
              emptyLabel="No responses for the selected filters."
              renderRow={(item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.time}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                      <img src={getModelVisual(item.model).icon} alt={item.model} className="h-3 w-3" decoding="async" />
                      {getModelVisual(item.model).label}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[280px] max-w-[360px]">
                    <div className="line-clamp-2 font-medium leading-6">{truncate(item.prompt, 96)}</div>
                    {item.persona ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">{item.persona}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.mention ? "secondary" : "destructive"}>{item.mention ? "Mentioned" : "Missing"}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.rank ? (
                      <Badge className={cn("border", rankTone(item.rank))}>#{item.rank}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">{item.competitor}</span>
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
                        No error
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedResponseId(item.id)}>
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            />
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-sm text-muted-foreground">
                {filteredResponses.length} / {filteredResponsesTotal} responses loaded
              </div>
              {hasMoreResponses ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={loadMoreResponses}>
                  Load more
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {filteredResponses.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedResponseId(item.id)}
                  className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      {item.time} · {item.model}
                    </div>
                    <Badge variant={item.error ? "destructive" : "secondary"}>{item.error ? "Error" : "OK"}</Badge>
                  </div>
                  <p className="mt-1 text-sm">{truncate(item.prompt, 80)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mention: {item.mention ? "Yes" : "No"} · Rank: {item.rank ?? "-"} · Competitor: {item.competitor}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-sm text-muted-foreground">
                {filteredResponses.length} / {filteredResponsesTotal} responses loaded
              </div>
              {hasMoreResponses ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={loadMoreResponses}>
                  Load more
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
