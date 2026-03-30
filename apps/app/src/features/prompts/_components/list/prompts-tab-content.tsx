import { useState } from "react";
import { ChevronLeft, ChevronRight, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceTable, type WorkspaceTableColumn } from "../../components/workspace-table";
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
  statusBadgeVariant: (status: PromptItem["status"]) => "secondary" | "outline" | "destructive";
  onRunSelect: (runId: string) => void;
  promptPage: number;
  promptTotalItems: number;
  promptTotalPages: number;
  canPreviousPromptPage: boolean;
  canNextPromptPage: boolean;
  setPromptPage: (page: number) => void;
};

export function PromptsTabContent(props: PromptsTabContentProps) {
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<PromptItem | null>(null);
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
    { id: "prompt", label: <SortableColumnHeader label="Prompt" sortKey="prompt" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} /> },
    { id: "ai", label: <SortableColumnHeader label={props.promptRowMode === "global" ? "Couverture IA" : "IA"} sortKey="ai" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} /> },
    { id: "cadence", label: "Cadence" },
    { id: "mention", label: <SortableColumnHeader label={props.promptRowMode === "global" ? "Mention globale" : "Mention IA"} sortKey="mention" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} /> },
    { id: "rank", label: <SortableColumnHeader label="Classement" sortKey="rank" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} /> },
    { id: "sov", label: <SortableColumnHeader label="SOV" sortKey="sov" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} /> },
    { id: "last-run", label: <SortableColumnHeader label="Derniere execution" sortKey="lastRun" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} /> },
    { id: "status", label: <SortableColumnHeader label="Statut" sortKey="status" promptSort={props.promptSort} promptSortDirection={props.promptSortDirection} changePromptSort={props.changePromptSort} /> },
    { id: "actions", label: "Actions", className: "text-right" },
  ];
  const canEditGlobalStatus = props.promptRowMode === "global";

  return (
    <>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-4 pt-2 pb-3">
            <div className="flex flex-nowrap items-center justify-between gap-3 overflow-x-auto">
              <Badge variant="outline" className="shrink-0">{props.promptTotalItems} prompts</Badge>
              <div className="flex shrink-0 items-center gap-2">
                <RunSelectedButton
                  disabled={!props.canRunSelectedPrompts || props.runningSelectedPrompts || props.runningAnyPrompts}
                  runningSelectedPrompts={props.runningSelectedPrompts}
                  selectedRunnablePromptCount={props.selectedRunnablePromptCount}
                  runSelectedPrompts={props.runSelectedPrompts}
                />
                <BulkStatusButton label="Activer" toneClassName="text-primary" disabled={props.selectedPromptIds.length === 0 || !canEditGlobalStatus} onClick={() => props.applyBulkStatus("active")} />
                <BulkStatusButton label="Desactiver" toneClassName="text-primary" disabled={props.selectedPromptIds.length === 0 || !canEditGlobalStatus} onClick={() => props.applyBulkStatus("disabled")} />
                <BulkStatusButton label="Archiver" toneClassName="text-primary" disabled={props.selectedPromptIds.length === 0 || !canEditGlobalStatus} onClick={() => props.applyBulkStatus("archived")} />
                <PromptRowModeSwitch promptRowMode={props.promptRowMode} setPromptRowMode={props.setPromptRowMode} />
              </div>
            </div>
            {!canEditGlobalStatus && props.selectedPromptIds.length > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Le statut s'applique au prompt complet. Passez en vue globale pour desactiver ou archiver un prompt.
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <div className="hidden min-h-0 w-full md:block">
              <div className="overflow-x-auto pb-4">
                <WorkspaceTable
                  tableClassName="min-w-[1120px]"
                  columns={promptsColumns}
                  rows={props.filteredPrompts}
                  getRowKey={(item) => item.id}
                  emptyLabel={props.promptsLoading ? "Chargement des prompts..." : "Aucun prompt ne correspond aux filtres actuels."}
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
                      statusBadgeVariant: props.statusBadgeVariant,
                      onRunSelect: props.onRunSelect,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {props.filteredPrompts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
                  {props.promptsLoading ? "Chargement des prompts..." : "Aucun prompt ne correspond aux filtres actuels."}
                </div>
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
                    statusBadgeVariant={props.statusBadgeVariant}
                    onRunSelect={props.onRunSelect}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 md:px-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Page {props.promptPage} / {props.promptTotalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={!props.canPreviousPromptPage || props.promptsLoading} onClick={() => props.setPromptPage(props.promptPage - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Precedent
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={!props.canNextPromptPage || props.promptsLoading} onClick={() => props.setPromptPage(props.promptPage + 1)}>
                Suivant
                <ChevronRight className="ml-1 h-4 w-4" />
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
