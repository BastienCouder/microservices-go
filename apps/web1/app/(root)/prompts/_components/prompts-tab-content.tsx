"use client";

import Image from "next/image";
import {
  ArrowUpDown,
  CircleDot,
  Copy,
  Eye,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { WorkspaceTable, WorkspaceTableColumn } from "./workspace-table";
import { ModelVisual, PromptItem, PromptSort } from "./types";
import { PromptDetailAside } from "./prompt-detail-aside";
import { cn } from "@/lib/utils";

type PromptsTabContentProps = {
  filteredPrompts: PromptItem[];
  selectedPromptIds: string[];
  selectedPrompt: PromptItem | null;
  promptSort: PromptSort;
  setPromptSort: (value: PromptSort) => void;
  toggleSelectAllPrompts: (checked: boolean) => void;
  togglePromptSelection: (id: string) => void;
  setSelectedPromptId: (id: string) => void;
  setIsPromptDetailsOpen: (open: boolean) => void;
  applyBulkStatus: (status: PromptItem["status"]) => void;
  setFocusPromptId: (id: string | null) => void;
  setTabResponses: () => void;
  deletePrompt: (id: string) => void;
  getModelVisual: (model: string) => ModelVisual;
  rankTone: (rank: number) => string;
  statusBadgeVariant: (status: PromptItem["status"]) => "secondary" | "outline" | "destructive";
  onRunSelect: (runId: string) => void;
};

export function PromptsTabContent({
  filteredPrompts,
  selectedPromptIds,
  selectedPrompt,
  promptSort,
  setPromptSort,
  toggleSelectAllPrompts,
  togglePromptSelection,
  setSelectedPromptId,
  setIsPromptDetailsOpen,
  applyBulkStatus,
  setFocusPromptId,
  setTabResponses,
  deletePrompt,
  getModelVisual,
  rankTone,
  statusBadgeVariant,
  onRunSelect,
}: PromptsTabContentProps) {
  const promptsColumns: WorkspaceTableColumn[] = [
    {
      id: "select",
      className: "w-[36px]",
      label: (
        <Checkbox
          checked={filteredPrompts.length > 0 && selectedPromptIds.length === filteredPrompts.length}
          onCheckedChange={(checked) => toggleSelectAllPrompts(Boolean(checked))}
        />
      ),
    },
    { id: "prompt", label: "Prompt" },
    { id: "persona", label: "Persona" },
    { id: "ai", label: "AI" },
    { id: "mention", label: "Mention" },
    { id: "rank", label: "Rank" },
    { id: "sov", label: "SOV" },
    { id: "last-run", label: "Last run" },
    { id: "status", label: "Status" },
    { id: "actions", label: "Actions", className: "text-right" },
  ];

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <Select value={promptSort} onValueChange={(value) => setPromptSort(value as PromptSort)}>
              <SelectTrigger className="h-8 w-[180px]">
                <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mention">Sort: Mention rate</SelectItem>
                <SelectItem value="rank">Sort: Rank (asc)</SelectItem>
                <SelectItem value="sov">Sort: SOV</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredPrompts.length} prompts</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={selectedPromptIds.length === 0} onClick={() => applyBulkStatus("active")}>
              Activate
            </Button>
            <Button size="sm" variant="outline" disabled={selectedPromptIds.length === 0} onClick={() => applyBulkStatus("disabled")}>
              Disable
            </Button>
            <Button size="sm" variant="outline" disabled={selectedPromptIds.length === 0} onClick={() => applyBulkStatus("archived")}>
              Archive
            </Button>
          </div>
        </div>

        <div className="min-h-0 w-full flex-1 overflow-auto">
          <WorkspaceTable
            columns={promptsColumns}
            rows={filteredPrompts}
            getRowKey={(item) => item.id}
            emptyLabel="No prompts match the current filters."
            renderRow={(item) => (
              <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedPromptId(item.id)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={selectedPromptIds.includes(item.id)} onCheckedChange={() => togglePromptSelection(item.id)} />
                </TableCell>
                <TableCell className="max-w-[260px]">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 rounded-md bg-muted p-1">
                      <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{item.prompt}</div>
                      <div className="mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {item.stage}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">{item.persona}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.models.map((model) => (
                      <span key={`${item.id}-${model}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]">
                        <Image src={getModelVisual(model).icon} alt={model} width={12} height={12} className="h-3 w-3" />
                        {getModelVisual(model).label}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="w-20">
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
                  <Badge className={cn("border", rankTone(item.rank))}>
                    <Trophy className="mr-1 h-3 w-3" />
                    {item.rank.toFixed(1)}
                  </Badge>
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
                    <span className={cn("h-1.5 w-1.5 rounded-full", item.lastRunMinutes < 60 ? "bg-emerald-500" : "bg-amber-500")} />
                    {item.lastRunMinutes < 60 ? `${item.lastRunMinutes}m ago` : `${Math.floor(item.lastRunMinutes / 60)}h ago`}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
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
                          if (typeof navigator !== "undefined") void navigator.clipboard.writeText(item.prompt);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Copy prompt
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="2xl:hidden"
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
                          setFocusPromptId(item.id);
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
                          deletePrompt(item.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete prompt
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )}
          />
        </div>
      </div>

      <PromptDetailAside
        selectedPrompt={selectedPrompt}
        onRunSelect={(runId) => {
          onRunSelect(runId);
          setTabResponses();
        }}
      />
    </div>
  );
}
