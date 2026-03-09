import {
  ArrowDown,
  ArrowUpDown,
  ArrowUp,
  Bot,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Layers3,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ModelVisual, PromptItem, PromptRowMode, PromptSort, PromptSortDirection } from "./types";
import { WorkspaceTable, WorkspaceTableColumn } from "./workspace-table";

type PromptsTabContentProps = {
  filteredPrompts: PromptItem[];
  promptsLoading: boolean;
  hasPersonas: boolean;
  selectedPromptIds: string[];
  selectedPrompt: PromptItem | null;
  promptSort: PromptSort;
  promptSortDirection: PromptSortDirection;
  changePromptSort: (value: PromptSort) => void;
  promptRowMode: PromptRowMode;
  setPromptRowMode: (value: PromptRowMode) => void;
  getPromptSelectionKey: (item: PromptItem) => string;
  toggleSelectAllPrompts: (checked: boolean) => void;
  togglePromptSelection: (id: string) => void;
  setSelectedPromptId: (id: string) => void;
  setIsPromptDetailsOpen: (open: boolean) => void;
  applyBulkStatus: (status: PromptItem["status"]) => void;
  setFocusPromptId: (id: string | null) => void;
  setTabResponses: () => void;
  deletePrompt: (id: string) => void;
  onEditPromptModels: (id: string) => void;
  onEditPromptSchedule: (id: string) => void;
  getModelVisual: (model: string) => ModelVisual;
  rankTone: (rank: number) => string;
  statusBadgeVariant: (status: PromptItem["status"]) => "secondary" | "outline" | "destructive";
  onRunSelect: (runId: string) => void;
  promptPage: number;
  promptTotalItems: number;
  promptTotalPages: number;
  canPreviousPromptPage: boolean;
  canNextPromptPage: boolean;
  setPromptPage: (page: number) => void;
};

function SortableColumnHeader({
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

function PromptModelBadges({
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
          const tooltipLabel = visual.description?.trim() || visual.label || model;

          return (
            <Tooltip key={`${item.id}-${model}`}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="inline-flex shrink-0 cursor-default items-center gap-1 rounded-full border px-2 py-1 text-[11px] outline-none"
                >
                  <img
                    src={visual.icon}
                    alt={model}
                    className="h-3 w-3"
                    decoding="async"
                  />
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
                {hiddenModels.map((model) => (
                  <div key={`${item.id}-${model}-hidden`}>{getModelVisual(model).description || getModelVisual(model).label || model}</div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function PromptActions({
  item,
  setSelectedPromptId,
  setIsPromptDetailsOpen,
  setFocusPromptId,
  setTabResponses,
  deletePrompt,
  onEditPromptModels,
  onEditPromptSchedule,
}: {
  item: PromptItem;
  setSelectedPromptId: (id: string) => void;
  setIsPromptDetailsOpen: (open: boolean) => void;
  setFocusPromptId: (id: string | null) => void;
  setTabResponses: () => void;
  deletePrompt: (id: string) => void;
  onEditPromptModels: (id: string) => void;
  onEditPromptSchedule: (id: string) => void;
}) {
  const sourcePromptId = item.sourcePromptId || item.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        <Button size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Prompt actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={(event) => event.stopPropagation()}>
          <Pencil className="h-4 w-4" />
          Edit prompt
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEditPromptSchedule(sourcePromptId);
          }}
        >
          <Clock3 className="h-4 w-4" />
          Edit analysis cadence
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEditPromptModels(sourcePromptId);
          }}
        >
          <Bot className="h-4 w-4" />
          Edit AI coverage
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            if (typeof navigator !== "undefined") void navigator.clipboard.writeText(item.prompt);
          }}
        >
          <Copy className="h-4 w-4" />
          Copy prompt
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            setSelectedPromptId(item.id);
            setIsPromptDetailsOpen(true);
          }}
        >
          <PanelRightOpen className="h-4 w-4" />
          Open details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            setFocusPromptId(sourcePromptId);
            setTabResponses();
          }}
        >
          <Eye className="h-4 w-4" />
          See responses
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            deletePrompt(sourcePromptId);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete prompt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BulkStatusButton({
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

export function PromptsTabContent({
  filteredPrompts,
  promptsLoading,
  hasPersonas,
  selectedPromptIds,
  selectedPrompt,
  promptSort,
  promptSortDirection,
  changePromptSort,
  promptRowMode,
  setPromptRowMode,
  getPromptSelectionKey,
  toggleSelectAllPrompts,
  togglePromptSelection,
  setSelectedPromptId,
  setIsPromptDetailsOpen,
  applyBulkStatus,
  setFocusPromptId,
  setTabResponses,
  deletePrompt,
  onEditPromptModels,
  onEditPromptSchedule,
  getModelVisual,
  rankTone,
  statusBadgeVariant,
  onRunSelect,
  promptPage,
  promptTotalItems,
  promptTotalPages,
  canPreviousPromptPage,
  canNextPromptPage,
  setPromptPage,
}: PromptsTabContentProps) {
  const promptsColumns: WorkspaceTableColumn[] = [
    {
      id: "select",
      className: "w-[36px]",
      label: (
        <Checkbox
          checked={
            filteredPrompts.length > 0 &&
            Array.from(new Set(filteredPrompts.map((item) => getPromptSelectionKey(item)))).every(
              (id) => selectedPromptIds.includes(id),
            )
          }
          onCheckedChange={(checked) => toggleSelectAllPrompts(Boolean(checked))}
        />
      ),
    },
    {
      id: "prompt",
      label: (
        <SortableColumnHeader
          label="Prompt"
          sortKey="prompt"
          promptSort={promptSort}
          promptSortDirection={promptSortDirection}
          changePromptSort={changePromptSort}
        />
      ),
    },
    ...(hasPersonas
      ? [
          {
            id: "persona",
            label: (
              <SortableColumnHeader
                label="Persona"
                sortKey="persona"
                promptSort={promptSort}
                promptSortDirection={promptSortDirection}
                changePromptSort={changePromptSort}
              />
            ),
          } satisfies WorkspaceTableColumn,
        ]
      : []),
    {
      id: "ai",
      label: (
        <SortableColumnHeader
          label={promptRowMode === "global" ? "AI coverage" : "AI"}
          sortKey="ai"
          promptSort={promptSort}
          promptSortDirection={promptSortDirection}
          changePromptSort={changePromptSort}
        />
      ),
    },
    {
      id: "cadence",
      label: "Cadence",
    },
    {
      id: "mention",
      label: (
        <SortableColumnHeader
          label={promptRowMode === "global" ? "Mention globale" : "Mention IA"}
          sortKey="mention"
          promptSort={promptSort}
          promptSortDirection={promptSortDirection}
          changePromptSort={changePromptSort}
        />
      ),
    },
    {
      id: "rank",
      label: (
        <SortableColumnHeader
          label="Rank"
          sortKey="rank"
          promptSort={promptSort}
          promptSortDirection={promptSortDirection}
          changePromptSort={changePromptSort}
        />
      ),
    },
    {
      id: "sov",
      label: (
        <SortableColumnHeader
          label="SOV"
          sortKey="sov"
          promptSort={promptSort}
          promptSortDirection={promptSortDirection}
          changePromptSort={changePromptSort}
        />
      ),
    },
    {
      id: "last-run",
      label: (
        <SortableColumnHeader
          label="Last run"
          sortKey="lastRun"
          promptSort={promptSort}
          promptSortDirection={promptSortDirection}
          changePromptSort={changePromptSort}
        />
      ),
    },
    {
      id: "status",
      label: (
        <SortableColumnHeader
          label="Status"
          sortKey="status"
          promptSort={promptSort}
          promptSortDirection={promptSortDirection}
          changePromptSort={changePromptSort}
        />
      ),
    },
    { id: "actions", label: "Actions", className: "text-right" },
  ];

  const countLabel =
    promptRowMode === "global" ? `${promptTotalItems} prompts` : `${promptTotalItems} rows`;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 pt-2 pb-3">
          <div className="flex flex-nowrap items-center justify-between gap-3 overflow-x-auto">
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="shrink-0">{countLabel}</Badge>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <BulkStatusButton
                label="Activate"
                toneClassName="text-emerald-600"
                disabled={selectedPromptIds.length === 0}
                onClick={() => applyBulkStatus("active")}
              />
              <BulkStatusButton
                label="Disable"
                toneClassName="text-amber-600"
                disabled={selectedPromptIds.length === 0}
                onClick={() => applyBulkStatus("disabled")}
              />
              <BulkStatusButton
                label="Archive"
                toneClassName="text-rose-600"
                disabled={selectedPromptIds.length === 0}
                onClick={() => applyBulkStatus("archived")}
              />
              <div className="flex shrink-0 gap-1 rounded-full border p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={promptRowMode === "global" ? "default" : "ghost"}
                  className="h-8 rounded-full px-2.5 text-xs sm:h-7 sm:px-2"
                  onClick={() => setPromptRowMode("global")}
                >
                  <Layers3 className="mr-1 h-3.5 w-3.5" />
                  Global
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
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <div className="hidden min-h-0 w-full md:block">
            <div className="overflow-x-auto pb-4">
              <WorkspaceTable
                tableClassName="min-w-[1120px]"
                columns={promptsColumns}
                rows={filteredPrompts}
                getRowKey={(item) => item.id}
                emptyLabel={promptsLoading ? "Loading prompts..." : "No prompts match the current filters."}
                renderRow={(item) => {
                  const sourcePromptId = item.sourcePromptId || item.id;
                  const selectionKey = getPromptSelectionKey(item);

                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedPromptId(item.id);
                        setIsPromptDetailsOpen(true);
                      }}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedPromptIds.includes(selectionKey)}
                          onCheckedChange={() => togglePromptSelection(selectionKey)}
                        />
                      </TableCell>
                      <TableCell className="min-w-[280px] max-w-[340px]">
                        <div className="min-w-0">
                          <div className="truncate font-medium leading-6">{item.prompt}</div>
                        </div>
                      </TableCell>
                      {hasPersonas ? (
                        <TableCell>
                          {item.persona ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                              {item.persona}
                            </div>
                          ) : null}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <PromptModelBadges
                          item={item}
                          getModelVisual={getModelVisual}
                          singleLine={promptRowMode === "global"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[170px]">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            {item.effectiveScheduleLabel}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{item.mentionRate}%</span>
                            <TrendingUp className="h-3 w-3 text-emerald-600" />
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted">
                            <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${item.mentionRate}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", rankTone(item.rank))}>{item.rank.toFixed(1)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-16">
                          <div className="text-xs font-medium">{item.sov}%</div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${item.sov}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              item.lastRunMinutes < 60 ? "bg-emerald-500" : "bg-amber-500",
                            )}
                          />
                          {item.lastRunMinutes < 60
                            ? `${item.lastRunMinutes}m ago`
                            : `${Math.floor(item.lastRunMinutes / 60)}h ago`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <PromptActions
                          item={item}
                          setSelectedPromptId={setSelectedPromptId}
                          setIsPromptDetailsOpen={setIsPromptDetailsOpen}
                          setFocusPromptId={setFocusPromptId}
                          setTabResponses={setTabResponses}
                          deletePrompt={deletePrompt}
                          onEditPromptModels={onEditPromptModels}
                          onEditPromptSchedule={onEditPromptSchedule}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }}
              />
            </div>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {filteredPrompts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
                {promptsLoading ? "Loading prompts..." : "No prompts match the current filters."}
              </div>
            ) : (
              filteredPrompts.map((item) => {
                const sourcePromptId = item.sourcePromptId || item.id;
                const selectionKey = getPromptSelectionKey(item);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedPromptId(item.id);
                      setIsPromptDetailsOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedPromptId(item.id);
                        setIsPromptDetailsOpen(true);
                      }
                    }}
                    className="w-full rounded-2xl border border-border/70 bg-card/80 p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedPromptIds.includes(selectionKey)}
                          onCheckedChange={() => togglePromptSelection(selectionKey)}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="space-y-2">
                          <div className="line-clamp-3 text-sm font-medium leading-6">{item.prompt}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{promptRowMode === "global" ? "Global" : "Par IA"}</Badge>
                            {item.persona ? <Badge variant="outline">{item.persona}</Badge> : null}
                            <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                          </div>
                        </div>

                        <PromptModelBadges item={item} getModelVisual={getModelVisual} />

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Mention</div>
                            <div className="mt-1 font-semibold">{item.mentionRate}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Rank</div>
                            <div className="mt-1 font-semibold">{item.rank.toFixed(1)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Cadence</div>
                            <div className="mt-1 font-semibold">{item.effectiveScheduleLabel}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">SOV</div>
                            <div className="mt-1 font-semibold">{item.sov}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Last run</div>
                            <div className="mt-1 font-semibold">
                              {item.lastRunMinutes < 60
                                ? `${item.lastRunMinutes}m ago`
                                : `${Math.floor(item.lastRunMinutes / 60)}h ago`}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFocusPromptId(sourcePromptId);
                              setTabResponses();
                            }}
                          >
                            See responses
                          </Button>
                          {item.runs[0]?.id ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRunSelect(item.runs[0]!.id);
                              }}
                            >
                              Open run
                            </Button>
                          ) : null}
                          <div className="ml-auto" onClick={(event) => event.stopPropagation()}>
                            <PromptActions
                              item={item}
                              setSelectedPromptId={setSelectedPromptId}
                              setIsPromptDetailsOpen={setIsPromptDetailsOpen}
                              setFocusPromptId={setFocusPromptId}
                              setTabResponses={setTabResponses}
                              deletePrompt={deletePrompt}
                              onEditPromptModels={onEditPromptModels}
                              onEditPromptSchedule={onEditPromptSchedule}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-3 md:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Page {promptPage} / {promptTotalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={!canPreviousPromptPage || promptsLoading}
              onClick={() => setPromptPage(promptPage - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={!canNextPromptPage || promptsLoading}
              onClick={() => setPromptPage(promptPage + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
