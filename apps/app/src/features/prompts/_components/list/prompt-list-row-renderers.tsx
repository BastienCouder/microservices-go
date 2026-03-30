import { Bot, Layers3, Play, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { promptStatusLabel, relativeRunLabel } from "../../_lib/utils";
import type { ModelVisual, PromptItem, PromptRowMode } from "../../_lib/types";
import { PromptActions, PromptModelBadges } from "./prompt-list-parts";

type SharedProps = {
  selectedPromptIds: string[];
  promptRowMode: PromptRowMode;
  getPromptSelectionKey: (item: PromptItem) => string;
  togglePromptSelection: (id: string) => void;
  setSelectedPromptId: (id: string) => void;
  setIsPromptDetailsOpen: (open: boolean) => void;
  setFocusPromptId: (id: string | null) => void;
  setTabResponses: () => void;
  requestDeletePrompt: (item: PromptItem) => void;
  onEditPrompt: (id: string) => void;
  canRunPrompt: (item: PromptItem | null) => boolean;
  runPrompt: (item: PromptItem) => void;
  isPromptRunning: (item: PromptItem | null) => boolean;
  runningAnyPrompts: boolean;
  getModelVisual: (model: string) => ModelVisual;
  rankTone: (rank: number) => string;
  statusBadgeVariant: (status: PromptItem["status"]) => "secondary" | "outline" | "destructive";
  onRunSelect: (runId: string) => void;
};

export function renderPromptDesktopRow(item: PromptItem, props: SharedProps) {
  const selectionKey = props.getPromptSelectionKey(item);
  const hasResults = item.runs.length > 0;

  return (
    <TableRow
      key={item.id}
      className="cursor-pointer"
      onClick={() => {
        props.setSelectedPromptId(item.id);
        props.setIsPromptDetailsOpen(true);
      }}
    >
      <TableCell onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={props.selectedPromptIds.includes(selectionKey)}
          onCheckedChange={() => props.togglePromptSelection(selectionKey)}
        />
      </TableCell>
      <TableCell className="min-w-[280px] max-w-[340px]">
        <div className="truncate font-medium leading-6">{item.prompt}</div>
      </TableCell>
      <TableCell>
        <PromptModelBadges
          item={item}
          getModelVisual={props.getModelVisual}
          singleLine={props.promptRowMode === "global"}
        />
      </TableCell>
      <TableCell>
        <div className="min-w-[170px] text-xs font-medium">{item.effectiveScheduleLabel}</div>
      </TableCell>
      <TableCell>
        {hasResults ? (
          <div className="w-24">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{item.mentionRate}%</span>
              <TrendingUp className="h-3 w-3 text-emerald-600" />
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${item.mentionRate}%` }} />
            </div>
          </div>
        ) : null}
      </TableCell>
      <TableCell>{hasResults ? <Badge className={props.rankTone(item.rank)}>{item.rank.toFixed(1)}</Badge> : null}</TableCell>
      <TableCell>
        {hasResults ? (
          <div className="w-16">
            <div className="text-xs font-medium">{item.sov}%</div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${item.sov}%` }} />
            </div>
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        {hasResults ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                item.lastRunMinutes < 60 ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            {relativeRunLabel(item.lastRunMinutes)}
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant={props.statusBadgeVariant(item.status)}>{promptStatusLabel(item.status)}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <PromptActions
          item={item}
          setSelectedPromptId={props.setSelectedPromptId}
          setIsPromptDetailsOpen={props.setIsPromptDetailsOpen}
          setFocusPromptId={props.setFocusPromptId}
          setTabResponses={props.setTabResponses}
          requestDeletePrompt={props.requestDeletePrompt}
          onEditPrompt={props.onEditPrompt}
          canRunPrompt={props.canRunPrompt}
          runPrompt={props.runPrompt}
          isPromptRunning={props.isPromptRunning}
          runningAnyPrompts={props.runningAnyPrompts}
        />
      </TableCell>
    </TableRow>
  );
}

export function PromptMobileCard({ item, ...props }: { item: PromptItem } & SharedProps) {
  const sourcePromptId = item.sourcePromptId || item.id;
  const selectionKey = props.getPromptSelectionKey(item);
  const hasResults = item.runs.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        props.setSelectedPromptId(item.id);
        props.setIsPromptDetailsOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.setSelectedPromptId(item.id);
          props.setIsPromptDetailsOpen(true);
        }
      }}
      className="w-full rounded-2xl border border-border/70 bg-card/80 p-4 text-left"
    >
      <div className="flex items-start gap-3">
        <div onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={props.selectedPromptIds.includes(selectionKey)}
            onCheckedChange={() => props.togglePromptSelection(selectionKey)}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <div className="line-clamp-3 text-sm font-medium leading-6">{item.prompt}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{props.promptRowMode === "global" ? "Vue globale" : "Par IA"}</Badge>
              <Badge variant={props.statusBadgeVariant(item.status)}>{promptStatusLabel(item.status)}</Badge>
            </div>
          </div>

          <PromptModelBadges item={item} getModelVisual={props.getModelVisual} />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Mention" value={hasResults ? `${item.mentionRate}%` : null} />
            <Metric label="Classement" value={hasResults ? item.rank.toFixed(1) : null} />
            <Metric label="Cadence" value={item.effectiveScheduleLabel} />
            <Metric label="SOV" value={hasResults ? `${item.sov}%` : null} />
            <Metric label="Derniere execution" value={hasResults ? relativeRunLabel(item.lastRunMinutes) : null} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={(event) => {
                event.stopPropagation();
                props.setFocusPromptId(sourcePromptId);
                props.setTabResponses();
              }}
            >
              Voir les reponses
            </Button>
            {item.runs[0]?.id ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onRunSelect(item.runs[0]!.id);
                }}
              >
                Ouvrir l'execution
              </Button>
            ) : null}
            <div className="ml-auto" onClick={(event) => event.stopPropagation()}>
              <PromptActions
                item={item}
                setSelectedPromptId={props.setSelectedPromptId}
                setIsPromptDetailsOpen={props.setIsPromptDetailsOpen}
                setFocusPromptId={props.setFocusPromptId}
                setTabResponses={props.setTabResponses}
                requestDeletePrompt={props.requestDeletePrompt}
                onEditPrompt={props.onEditPrompt}
                canRunPrompt={props.canRunPrompt}
                runPrompt={props.runPrompt}
                isPromptRunning={props.isPromptRunning}
                runningAnyPrompts={props.runningAnyPrompts}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

export function PromptRowModeSwitch({
  promptRowMode,
  setPromptRowMode,
}: {
  promptRowMode: PromptRowMode;
  setPromptRowMode: (value: PromptRowMode) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1 rounded-full border p-1">
      <Button
        type="button"
        size="sm"
        variant={promptRowMode === "global" ? "default" : "ghost"}
        className="h-8 rounded-full px-2.5 text-xs sm:h-7 sm:px-2"
        onClick={() => setPromptRowMode("global")}
      >
        <Layers3 className="mr-1 h-3.5 w-3.5" />
        Vue globale
      </Button>
      <Button
        type="button"
        size="sm"
        variant={promptRowMode === "model" ? "default" : "ghost"}
        className="h-8 rounded-full px-2.5 text-xs sm:h-7 sm:px-2"
        onClick={() => setPromptRowMode("model")}
      >
        <Bot className="mr-1 h-3.5 w-3.5" />
        Par IA
      </Button>
    </div>
  );
}

export function RunSelectedButton({
  disabled,
  runningSelectedPrompts,
  selectedRunnablePromptCount,
  runSelectedPrompts,
}: {
  disabled: boolean;
  runningSelectedPrompts: boolean;
  selectedRunnablePromptCount: number;
  runSelectedPrompts: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 rounded-full px-3 text-xs sm:h-7 sm:px-2.5"
      disabled={disabled}
      onClick={runSelectedPrompts}
    >
      <Play className="mr-1.5 h-3.5 w-3.5" />
      {runningSelectedPrompts
        ? "Lancement..."
        : selectedRunnablePromptCount > 0
          ? `Lancer les prompts (${selectedRunnablePromptCount})`
          : "Lancer les prompts"}
    </Button>
  );
}
