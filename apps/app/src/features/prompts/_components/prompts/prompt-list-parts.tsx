import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  PanelRightOpen,
  Pencil,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionsPopover, type ActionsPopoverItem } from "@/components/shared/actions-popover";
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
  canEdit,
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
  canEdit: boolean;
}) {
  const content = useI18nScope("prompts-workspace");
  const sourcePromptId = item.sourcePromptId || item.id;
  const promptRunnable = canRunPrompt(item);
  const promptRunning = isPromptRunning(item);
  const runLabel = getRunPromptActionLabel(item, promptRunning, content);
  const editActions: ActionsPopoverItem[] = canEdit
    ? [
        {
          icon: promptRunnable ? Play : Sparkles,
          title: runLabel,
          disabled: !promptRunnable || promptRunning || runningAnyPrompts,
          onSelect: () => runPrompt(item),
        },
        {
          icon: Pencil,
          title: content.editPrompt,
          onSelect: () => onEditPrompt(sourcePromptId),
        },
      ]
    : [];
  const actions: ActionsPopoverItem[] = [
    ...editActions,
    {
      icon: Copy,
      title: content.copyPrompt,
      onSelect: () => {
        if (typeof navigator !== "undefined") void navigator.clipboard.writeText(item.prompt);
      },
    },
    {
      icon: PanelRightOpen,
      title: content.openDetails,
      onSelect: () => {
        setSelectedPromptId(item.id);
        setIsPromptDetailsOpen(true);
      },
    },
    {
      icon: Eye,
      title: content.viewResponses,
      onSelect: () => {
        setFocusPromptId(sourcePromptId);
        setTabResponses();
      },
    },
    ...(canEdit
      ? [
          {
            icon: Trash2,
            title: content.deletePrompt,
            tone: "destructive" as const,
            onSelect: () => requestDeletePrompt({ ...item, sourcePromptId }),
          },
        ]
      : []),
  ];

  return (
    <ActionsPopover
      title={content.promptActionsTitle}
      triggerLabel={content.promptActionsTitle}
      items={actions}
    />
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
      className="h-9 rounded-lg px-3 text-sm"
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" className={cn("mr-1.5 h-4 w-4", toneClassName)}>
        <circle cx="6" cy="6" r="4.25" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="6" cy="6" r="1.9" fill="currentColor" />
      </svg>
      {label}
    </Button>
  );
}
