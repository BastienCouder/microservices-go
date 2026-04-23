import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import type { ModelVisual, PromptItem, PromptSort, PromptSortDirection } from "../../_lib/types";

function getRunPromptActionLabel(
  item: PromptItem,
  promptRunning: boolean,
  content: Record<string, string>,
) {
  if (promptRunning) return content.launching;
  return item.runs.length > 0 ? content.rerunPrompt : content.runPrompt;
}

function stopPromptActionPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function PromptActionItem({
  icon: Icon,
  title,
  description,
  tone = "default",
  disabled = false,
  onSelect,
}: {
  icon: typeof Play;
  title: string;
  description: string;
  tone?: "default" | "destructive";
  disabled?: boolean;
  onSelect: (event: Event) => void;
}) {
  return (
    <DropdownMenuItem
      variant={tone}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "cursor-pointer group min-h-[58px] items-center gap-3 rounded-2xl border bg-background px-3 py-3 focus:bg-muted/30",
        tone === "destructive"
          ? "border-rose-200/80 focus:border-rose-300 focus:bg-rose-50/80"
          : "border-border/70 focus:border-border",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors",
          tone === "destructive"
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : "border-border/70 bg-muted/25 text-muted-foreground group-focus:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", tone === "destructive" ? "text-rose-700" : "text-foreground")}>
          {title}
        </div>
        <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {description}
        </div>
      </div>
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
          tone === "destructive" ? "bg-rose-400/80" : "bg-muted-foreground/25 group-focus:bg-primary/80",
        )}
        aria-hidden="true"
      />
    </DropdownMenuItem>
  );
}

export function SortableColumnHeader({
  label,
  sortKey,
  promptSort,
  promptSortDirection,
  changePromptSort,
}: {
  label: string;
  sortKey: PromptSort;
  promptSort: PromptSort;
  promptSortDirection: PromptSortDirection;
  changePromptSort: (value: PromptSort) => void;
}) {
  const isActive = promptSort === sortKey;
  const Icon = !isActive ? ArrowUpDown : promptSortDirection === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
        isActive && "text-foreground",
      )}
      onClick={() => changePromptSort(sortKey)}
    >
      <span>{label}</span>
      <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
    </button>
  );
}

export function PromptModelBadges({
  item,
  getModelVisual,
  singleLine = false,
}: {
  item: PromptItem;
  getModelVisual: (model: string) => ModelVisual;
  singleLine?: boolean;
}) {
  const maxVisibleModels = singleLine ? 1 : 2;
  const visibleModels = item.models.slice(0, maxVisibleModels);
  const hiddenModels = item.models.slice(maxVisibleModels);
  const remaining = item.models.length - visibleModels.length;

  return (
    <TooltipProvider delayDuration={120}>
      <div className={cn("flex items-center gap-1", singleLine ? "flex-nowrap overflow-hidden" : "flex-wrap")}>
        {visibleModels.map((model) => {
          const visual = getModelVisual(model);
          const tooltipLabel =
            [visual.provider, visual.name !== visual.label ? visual.name : ""]
              .filter(Boolean)
              .join(" · ") || visual.label || model;

          return (
            <Tooltip key={`${item.id}-${model}`}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm outline-none"
                >
                  <img src={visual.icon} alt={model} className="h-4 w-4" decoding="async" />
                  {visual.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={1}>
                {tooltipLabel}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {remaining > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="inline-flex shrink-0 cursor-default items-center rounded-full border px-2.5 py-1 text-sm text-muted-foreground outline-none"
              >
                +{remaining}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-sm">
              <div className="space-y-1">
                {hiddenModels.map((model) => {
                  const visual = getModelVisual(model);
                  return (
                    <div key={`${item.id}-${model}-hidden`}>
                      {[visual.provider, visual.name].filter(Boolean).join(" · ") || visual.label || model}
                    </div>
                  );
                })}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

export function PromptActions({
  item,
  setSelectedPromptId,
  setIsPromptDetailsOpen,
  setFocusPromptId,
  setTabResponses,
  requestDeletePrompt,
  onEditPrompt,
  canRunPrompt,
  runPrompt,
  isPromptRunning,
  runningAnyPrompts,
}: {
  item: PromptItem;
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
}) {
  const content = useI18nScope("prompts-workspace");
  const sourcePromptId = item.sourcePromptId || item.id;
  const promptRunnable = canRunPrompt(item);
  const promptRunning = isPromptRunning(item);
  const runLabel = getRunPromptActionLabel(item, promptRunning, content);

  return (
    <div
      onClick={stopPromptActionPropagation}
      onPointerDown={stopPromptActionPropagation}
      onKeyDown={stopPromptActionPropagation}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
          <Button size="icon" variant="ghost" className="rounded-full border border-transparent hover:border-border/70 hover:bg-muted/50">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[340px] max-w-[92vw] p-0">
          <FloatingPanelHeader
            title={content.promptActionsTitle}
            description={content.promptActionsDescription}
          />
          <div className="space-y-2 px-4 py-4">
            <PromptActionItem
              icon={promptRunnable ? Play : Sparkles}
              title={runLabel}
              description={
                promptRunnable
                  ? content.runNowDescription
                  : content.saveBeforeRunDescription
              }
              disabled={!promptRunnable || promptRunning || runningAnyPrompts}
              onSelect={(event) => {
                event.stopPropagation();
                runPrompt(item);
              }}
            />
            <PromptActionItem
              icon={Pencil}
              title={content.editPrompt}
              description={content.editPromptDescription}
              onSelect={(event) => {
                event.stopPropagation();
                onEditPrompt(sourcePromptId);
              }}
            />
            <PromptActionItem
              icon={Copy}
              title={content.copyPrompt}
              description={content.copyPromptDescription}
              onSelect={(event) => {
                event.stopPropagation();
                if (typeof navigator !== "undefined") void navigator.clipboard.writeText(item.prompt);
              }}
            />
            <PromptActionItem
              icon={PanelRightOpen}
              title={content.openDetails}
              description={content.openDetailsDescription}
              onSelect={(event) => {
                event.stopPropagation();
                setSelectedPromptId(item.id);
                setIsPromptDetailsOpen(true);
              }}
            />
            <PromptActionItem
              icon={Eye}
              title={content.viewResponses}
              description={content.viewResponsesDescription}
              onSelect={(event) => {
                event.stopPropagation();
                setFocusPromptId(sourcePromptId);
                setTabResponses();
              }}
            />
            <PromptActionItem
              icon={Trash2}
              title={content.deletePrompt}
              description={content.deletePromptDescription}
              tone="destructive"
              onSelect={(event) => {
                event.stopPropagation();
                requestDeletePrompt({ ...item, sourcePromptId });
              }}
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function BulkStatusButton({
  label,
  toneClassName,
  disabled,
  onClick,
}: {
  label: string;
  toneClassName: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 rounded-full px-3 text-sm sm:h-7 sm:px-2.5"
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" className={cn("mr-1.5 h-3.5 w-3.5", toneClassName)}>
        <circle cx="6" cy="6" r="4.25" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="6" cy="6" r="1.9" fill="currentColor" />
      </svg>
      {label}
    </Button>
  );
}
