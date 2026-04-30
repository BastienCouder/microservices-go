import { Bot, Layers3, Play, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { promptCadenceLabel, promptStatusLabel, relativeRunLabel } from "../../_lib/utils";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";
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
  statusBadgeClassName: (status: PromptItem["status"]) => string;
  onRunSelect: (runId: string) => void;
  locale: string;
  content: Record<string, string>;
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
      <TableCell className="min-w-[220px] max-w-[260px] xl:min-w-[280px] xl:max-w-[340px]">
        <div className="truncate text-sm font-medium leading-6">{item.prompt}</div>
      </TableCell>
      <TableCell>
        <div className="max-w-[128px] overflow-hidden xl:max-w-[180px]">
          <PromptModelBadges
            item={item}
            getModelVisual={props.getModelVisual}
            singleLine={props.promptRowMode === "global"}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[140px] truncate text-sm font-medium xl:max-w-[180px]">
          {promptCadenceLabel(item, props.locale)}
        </div>
      </TableCell>
      <TableCell>
        {hasResults ? (
          <div className="w-24">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{item.mentionRate}%</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${item.mentionRate}%` }} />
            </div>
          </div>
        ) : null}
      </TableCell>
      <TableCell>{hasResults ? <Badge className={cn("text-sm", props.rankTone(item.rank))}>{item.rank.toFixed(1)}</Badge> : null}</TableCell>
      <TableCell>
        {hasResults ? (
          <div className="w-16">
            <div className="text-sm font-medium">{item.sov}%</div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${item.sov}%` }} />
            </div>
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        {hasResults ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
            <span
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
            {relativeRunLabel(item.lastRunMinutes, props.locale)}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <Badge variant="outline" className={cn("text-sm", props.statusBadgeClassName(item.status))}>
          {promptStatusLabel(item.status, props.locale)}
        </Badge>
      </TableCell>
      <TableCell
        className="w-[56px] text-right"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
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
  const content = useI18nScope("prompts-workspace");
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
              <Badge variant="outline">
                {props.promptRowMode === "global" ? content.rowModeGlobal : content.rowModeModel}
              </Badge>
              <Badge variant="outline" className={props.statusBadgeClassName(item.status)}>
                {promptStatusLabel(item.status, props.locale)}
              </Badge>
            </div>
          </div>

          <PromptModelBadges item={item} getModelVisual={props.getModelVisual} />

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Metric label={content.mention} value={hasResults ? `${item.mentionRate}%` : null} />
            <Metric label={content.rank} value={hasResults ? item.rank.toFixed(1) : null} />
            <Metric
              label={content.columnCadence}
              value={promptCadenceLabel(item, props.locale)}
            />
            <Metric label={content.overviewSov} value={hasResults ? `${item.sov}%` : null} />
            <Metric
              label={content.columnLastRun}
              value={hasResults ? relativeRunLabel(item.lastRunMinutes, props.locale) : null}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full rounded-full sm:w-auto"
              onClick={(event) => {
                event.stopPropagation();
                props.setFocusPromptId(sourcePromptId);
                props.setTabResponses();
              }}
            >
              {content.viewResponses}
            </Button>
            {item.runs[0]?.id ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full rounded-full sm:w-auto"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onRunSelect(item.runs[0]!.id);
                }}
              >
                {content.openRun}
              </Button>
            ) : null}
            <div
              className="pt-1 sm:ml-auto sm:pt-0"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
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
  const content = useI18nScope("prompts-workspace");

  return (
    <div className="flex h-10 shrink-0 gap-1 rounded-full border p-1">
      <Button
        type="button"
        size="sm"
        variant={promptRowMode === "global" ? "default" : "ghost"}
        className="h-8 rounded-full px-3 text-sm"
        onClick={() => setPromptRowMode("global")}
      >
        <Layers3 className="mr-1.5 h-4 w-4" />
        {content.rowModeGlobal}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={promptRowMode === "model" ? "default" : "ghost"}
        className="h-8 rounded-full px-3 text-sm"
        onClick={() => setPromptRowMode("model")}
      >
        <Bot className="mr-1.5 h-4 w-4" />
        {content.rowModeModel}
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
  const { t } = useScopedI18n("prompts-workspace");

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-9 rounded-full px-3 text-sm"
      disabled={disabled}
      onClick={runSelectedPrompts}
    >
      <Play className="mr-1.5 h-4 w-4" />
      {runningSelectedPrompts
        ? t("launching")
        : selectedRunnablePromptCount === 0
          ? t("selectPromptToRun")
          : t("runSelectedPrompt", { count: selectedRunnablePromptCount })}
    </Button>
  );
}
