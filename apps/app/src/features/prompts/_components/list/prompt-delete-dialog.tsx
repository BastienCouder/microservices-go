import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import type { PromptItem } from "../../_lib/types";

export function PromptDeleteDialog({
  pendingDeletePrompt,
  promptsLoading,
  onOpenChange,
  onConfirm,
}: {
  pendingDeletePrompt: PromptItem | null;
  promptsLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (prompt: PromptItem) => void;
}) {
  return (
    <AlertDialog open={pendingDeletePrompt !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer ce prompt ?</AlertDialogTitle>
          <AlertDialogDescription>Ce prompt sera supprime definitivement.</AlertDialogDescription>
          {pendingDeletePrompt ? (
            <div className="mt-2 max-h-28 w-full overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3 text-left text-sm leading-6 break-words [overflow-wrap:anywhere]">
              {pendingDeletePrompt.prompt}
            </div>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={promptsLoading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!pendingDeletePrompt || promptsLoading}
            onClick={() => pendingDeletePrompt && onConfirm(pendingDeletePrompt)}
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
