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
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ModelVisual, PromptItem, PromptSort, PromptSortDirection } from "../../_lib/types";

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
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        isActive && "text-foreground",
      )}
      onClick={() => changePromptSort(sortKey)}
    >
      <span>{label}</span>
      <Icon className={cn("h-3.5 w-3.5", isActive && "text-primary")} />
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
  const visibleModels = item.models.slice(0, 2);
  const hiddenModels = item.models.slice(2);
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
                  className="inline-flex shrink-0 cursor-default items-center gap-1 rounded-full border px-2 py-1 text-[11px] outline-none"
                >
                  <img src={visual.icon} alt={model} className="h-3 w-3" decoding="async" />
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
                className="inline-flex shrink-0 cursor-default items-center rounded-full border px-2 py-1 text-[11px] text-muted-foreground outline-none"
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
  const sourcePromptId = item.sourcePromptId || item.id;
  const promptRunnable = canRunPrompt(item);
  const promptRunning = isPromptRunning(item);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        <Button size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem
          disabled={!promptRunnable || promptRunning || runningAnyPrompts}
          onClick={(event) => {
            event.stopPropagation();
            runPrompt(item);
          }}
        >
          <Play className="h-4 w-4" />
          {promptRunning ? "Lancement..." : "Lancer le prompt"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEditPrompt(sourcePromptId);
          }}
        >
          <Pencil className="h-4 w-4" />
          Modifier le prompt
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            if (typeof navigator !== "undefined") void navigator.clipboard.writeText(item.prompt);
          }}
        >
          <Copy className="h-4 w-4" />
          Copier le prompt
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            setSelectedPromptId(item.id);
            setIsPromptDetailsOpen(true);
          }}
        >
          <PanelRightOpen className="h-4 w-4" />
          Ouvrir les details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            setFocusPromptId(sourcePromptId);
            setTabResponses();
          }}
        >
          <Eye className="h-4 w-4" />
          Voir les reponses
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            requestDeletePrompt({ ...item, sourcePromptId });
          }}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer le prompt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      className="h-8 rounded-full px-3 text-xs sm:h-7 sm:px-2.5"
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
