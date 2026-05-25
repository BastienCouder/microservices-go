import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { PromptItem } from "../../_lib/types";

export function PromptDeleteDialog({
  pendingDeletePrompts,
  promptsLoading,
  onOpenChange,
  onConfirm,
}: {
  pendingDeletePrompts: PromptItem[];
  promptsLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (prompts: PromptItem[]) => void;
}) {
  const promptCount = pendingDeletePrompts.length;
  const isBulkDelete = promptCount > 1;

  return (
    <ConfirmDialog
      open={promptCount > 0}
      onOpenChange={onOpenChange}
      title={isBulkDelete ? "Supprimer ces prompts ?" : "Supprimer ce prompt ?"}
      description={
        isBulkDelete
          ? "Ces prompts seront supprimes definitivement."
          : "Ce prompt sera supprime definitivement."
      }
      confirmLabel="Supprimer"
      loading={promptsLoading}
      media={<Trash2 />}
      previewItems={pendingDeletePrompts.map((prompt) => prompt.prompt)}
      previewOverflowLabel={(remainingCount) => `+${remainingCount} autres prompts`}
      onConfirm={() => promptCount > 0 && onConfirm(pendingDeletePrompts)}
    />
  );
}
