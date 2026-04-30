import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { WorkspaceTable, type WorkspaceTableColumn } from "../shared/workspace-table";
import { PanelToolbar } from "../shared/panel-toolbar";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";
import type {
  ModelVisual,
  PromptItem,
  PromptRowMode,
  PromptSort,
  PromptSortDirection,
} from "../../_lib/types";
import { BulkStatusButton, SortableColumnHeader } from "./prompt-list-parts";
import {
  PromptMobileCard,
  PromptRowModeSwitch,
  RunSelectedButton,
  renderPromptDesktopRow,
} from "./prompt-list-row-renderers";
import { PromptDeleteDialog } from "./prompt-delete-dialog";
import { useIsMobile } from "@/shared/hooks/use-mobile";

type PromptsTabContentProps = {
  filteredPrompts: PromptItem[];
  promptsDataLoading: boolean;
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
  onEditPrompt: (id: string) => void;
  canRunPrompt: (item: PromptItem | null) => boolean;
  runPrompt: (item: PromptItem) => void;
  isPromptRunning: (item: PromptItem | null) => boolean;
  canRunSelectedPrompts: boolean;
  selectedRunnablePromptCount: number;
  runningSelectedPrompts: boolean;
  runningAnyPrompts: boolean;
  runSelectedPrompts: () => void;
  getModelVisual: (model: string) => ModelVisual;
  rankTone: (rank: number) => string;
  statusBadgeClassName: (status: PromptItem["status"]) => string;
  onRunSelect: (runId: string) => void;
  promptPage: number;
  promptTotalItems: number;
  promptTotalPages: number;
  canPreviousPromptPage: boolean;
  canNextPromptPage: boolean;
  setPromptPage: (page: number) => void;
};

function renderPromptLoadingRow(index: number) {
  return (
    <TableRow key={index}>
      <TableCell>
        <Skeleton className="h-4 w-4 rounded-sm" />
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-[360px]" />
          <Skeleton className="h-3 w-2/3 max-w-[260px]" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-7 w-28 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-16 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-12 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <Skeleton className="h-6 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto h-8 w-8 rounded-full" />
      </TableCell>
    </TableRow>
  );
}

function PromptMobileLoadingCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}

export function PromptsTabContent(props: PromptsTabContentProps) {
  const content = useI18nScope("prompts-workspace");
  const { locale, t } = useScopedI18n("prompts-workspace");
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<PromptItem | null>(null);
  const hasSelectedPrompts = props.selectedPromptIds.length > 0;
  const promptsColumns: WorkspaceTableColumn[] = [
    {
      id: "select",
      className: "w-[36px]",
      label: (
        <Checkbox
          checked={
            props.filteredPrompts.length > 0 &&
            Array.from(new Set(props.filteredPrompts.map((item) => props.getPromptSelectionKey(item)))).every(
              (id) => props.selectedPromptIds.includes(id),
            )
          }
          onCheckedChange={(checked) => props.toggleSelectAllPrompts(Boolean(checked))}
        />
      ),
    },
    {
      id: "prompt",
      label: <SortableColumnHeader label={content.prompt} sortKey="prompt" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} />,
    },
    {
      id: "ai",
      label: <SortableColumnHeader label={props.promptRowMode === "global" ? content.columnAiCoverage : content.ai} sortKey="ai" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} />,
    },
    { id: "cadence", label: content.columnCadence },
    {
      id: "mention",
      label: <SortableColumnHeader label={props.promptRowMode === "global" ? content.columnGlobalMention : content.columnAiMention} sortKey="mention" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} />,
    },
    {
      id: "rank",
      label: <SortableColumnHeader label={content.rank} sortKey="rank" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} />,
    },
    {
      id: "sov",
      label: <SortableColumnHeader label={content.overviewSov} sortKey="sov" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} />,
    },
    {
      id: "last-run",
      label: <SortableColumnHeader label={content.columnLastRun} sortKey="lastRun" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} />,
    },
    {
      id: "status",
      label: <SortableColumnHeader label={content.columnStatus} sortKey="status" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} />,
      className: "hidden xl:table-cell",
    },
    { id: "actions", label: content.columnActions, className: "w-[56px] text-right" },
  ];
  const canEditGlobalStatus = props.promptRowMode === "global";
  const isMobile = useIsMobile();
  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PanelToolbar
            summary={
              props.promptsDataLoading ? (
                <Skeleton className="h-9 w-32 rounded-full" />
              ) : (
                <Badge variant="outline" className="h-9 w-fit shrink-0 justify-center px-3 text-sm">
                  {t("promptsCount", { count: props.promptTotalItems })}
                </Badge>
              )
            }
          >
              <div className="flex flex-wrap items-center gap-2">
                {hasSelectedPrompts && isMobile ? (
                  <>
                    <RunSelectedButton
                      disabled={!props.canRunSelectedPrompts || props.runningSelectedPrompts || props.runningAnyPrompts}
                      runningSelectedPrompts={props.runningSelectedPrompts}
                      selectedRunnablePromptCount={props.selectedRunnablePromptCount}
                      runSelectedPrompts={props.runSelectedPrompts}
                    />
                    <BulkStatusButton
                      label={content.bulkActivate}
                      toneClassName="text-emerald-600"
                      disabled={!canEditGlobalStatus}
                      onClick={() => props.applyBulkStatus("active")}
                    />
                    <BulkStatusButton
                      label={content.bulkDisable}
                      toneClassName="text-amber-600"
                      disabled={!canEditGlobalStatus}
                      onClick={() => props.applyBulkStatus("disabled")}
                    />
                    <BulkStatusButton
                      label={content.bulkArchive}
                      toneClassName="text-rose-600"
                      disabled={!canEditGlobalStatus}
                      onClick={() => props.applyBulkStatus("archived")}
                    />
                  </>
                ) : null}
                {!isMobile ? (
                  <>
                    <RunSelectedButton
                      disabled={
                        !hasSelectedPrompts ||
                        !props.canRunSelectedPrompts ||
                        props.runningSelectedPrompts ||
                        props.runningAnyPrompts
                      }
                      runningSelectedPrompts={props.runningSelectedPrompts}
                      selectedRunnablePromptCount={props.selectedRunnablePromptCount}
                      runSelectedPrompts={props.runSelectedPrompts}
                    />
                    <BulkStatusButton
                      label={content.bulkActivate}
                      toneClassName="text-emerald-600"
                      disabled={!hasSelectedPrompts || !canEditGlobalStatus}
                      onClick={() => props.applyBulkStatus("active")}
                    />
                    <BulkStatusButton
                      label={content.bulkDisable}
                      toneClassName="text-amber-600"
                      disabled={!hasSelectedPrompts || !canEditGlobalStatus}
                      onClick={() => props.applyBulkStatus("disabled")}
                    />
                    <BulkStatusButton
                      label={content.bulkArchive}
                      toneClassName="text-rose-600"
                      disabled={!hasSelectedPrompts || !canEditGlobalStatus}
                      onClick={() => props.applyBulkStatus("archived")}
                    />
                  </>
                ) : null}
                <PromptRowModeSwitch promptRowMode={props.promptRowMode} setPromptRowMode={props.setPromptRowMode} />
              </div>
          </PanelToolbar>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4">
            <div className="hidden min-h-0 min-w-0 w-full lg:block">
              <div className="overflow-x-auto pb-4">
                <WorkspaceTable
                  tableClassName="lg:min-w-[980px] xl:min-w-[1120px]"
                  columns={promptsColumns}
                  rows={props.filteredPrompts}
                  getRowKey={(item) => item.id}
                  loading={props.promptsDataLoading}
                  loadingRowCount={6}
                  renderLoadingRow={renderPromptLoadingRow}
                  emptyLabel={props.promptsLoading ? content.loadingPrompts : content.noPromptsForFilters}
                  renderRow={(item) =>
                    renderPromptDesktopRow(item, {
                      selectedPromptIds: props.selectedPromptIds,
                      promptRowMode: props.promptRowMode,
                      getPromptSelectionKey: props.getPromptSelectionKey,
                      togglePromptSelection: props.togglePromptSelection,
                      setSelectedPromptId: props.setSelectedPromptId,
                      setIsPromptDetailsOpen: props.setIsPromptDetailsOpen,
                      setFocusPromptId: props.setFocusPromptId,
                      setTabResponses: props.setTabResponses,
                      requestDeletePrompt: setPendingDeletePrompt,
                      onEditPrompt: props.onEditPrompt,
                      canRunPrompt: props.canRunPrompt,
                      runPrompt: props.runPrompt,
                      isPromptRunning: props.isPromptRunning,
                      runningAnyPrompts: props.runningAnyPrompts,
                      getModelVisual: props.getModelVisual,
                      rankTone: props.rankTone,
                      statusBadgeClassName: props.statusBadgeClassName,
                      onRunSelect: props.onRunSelect,
                      locale,
                      content,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-3 py-4 lg:hidden">
              {props.promptsDataLoading ? (
                <PromptMobileLoadingCards />
              ) : props.filteredPrompts.length === 0 ? (
                <EmptyStateCard
                  label={props.promptsLoading ? content.loadingPrompts : content.noPromptsForFilters}
                />
              ) : (
                props.filteredPrompts.map((item) => (
                  <PromptMobileCard
                    key={item.id}
                    item={item}
                    selectedPromptIds={props.selectedPromptIds}
                    promptRowMode={props.promptRowMode}
                    getPromptSelectionKey={props.getPromptSelectionKey}
                    togglePromptSelection={props.togglePromptSelection}
                    setSelectedPromptId={props.setSelectedPromptId}
                    setIsPromptDetailsOpen={props.setIsPromptDetailsOpen}
                    setFocusPromptId={props.setFocusPromptId}
                    setTabResponses={props.setTabResponses}
                    requestDeletePrompt={setPendingDeletePrompt}
                    onEditPrompt={props.onEditPrompt}
                    canRunPrompt={props.canRunPrompt}
                    runPrompt={props.runPrompt}
                    isPromptRunning={props.isPromptRunning}
                    runningAnyPrompts={props.runningAnyPrompts}
                    getModelVisual={props.getModelVisual}
                    rankTone={props.rankTone}
                    statusBadgeClassName={props.statusBadgeClassName}
                    onRunSelect={props.onRunSelect}
                    locale={locale}
                    content={content}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 md:px-6">
            <div className="min-w-0 text-sm text-muted-foreground">
              {props.promptsDataLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                t("pageSummary", { page: props.promptPage, total: props.promptTotalPages })
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 rounded-full p-0 sm:h-8 sm:w-auto sm:px-3"
                disabled={!props.canPreviousPromptPage || props.promptsLoading}
                onClick={() => props.setPromptPage(props.promptPage - 1)}
                aria-label={content.previousPage}
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{content.previous}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 rounded-full p-0 sm:h-8 sm:w-auto sm:px-3"
                disabled={!props.canNextPromptPage || props.promptsLoading}
                onClick={() => props.setPromptPage(props.promptPage + 1)}
                aria-label={content.nextPage}
              >
                <span className="hidden sm:inline">{content.next}</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PromptDeleteDialog
        pendingDeletePrompt={pendingDeletePrompt}
        promptsLoading={props.promptsLoading}
        onOpenChange={(open) => !open && setPendingDeletePrompt(null)}
        onConfirm={(prompt) => {
          props.deletePrompt(prompt.sourcePromptId || prompt.id);
          setPendingDeletePrompt(null);
        }}
      />
    </>
  );
}
