import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
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
  const { t } = useScopedI18n("prompts-workspace");
  const promptCount = pendingDeletePrompts.length;
  const isBulkDelete = promptCount > 1;

  return (
    <ConfirmDialog
      open={promptCount > 0}
      onOpenChange={onOpenChange}
      title={isBulkDelete ? t("deletePromptsTitle") : t("deletePromptTitle")}
      description={
        isBulkDelete
          ? t("deletePromptsDescription")
          : t("deletePromptDescription")
      }
      confirmLabel={t("bulkDelete")}
      loading={promptsLoading}
      media={<Trash2 />}
      previewItems={pendingDeletePrompts.map((prompt) => prompt.prompt)}
      previewOverflowLabel={(remainingCount) =>
        t("deletePromptsOverflow", { count: remainingCount })
      }
      onConfirm={() => promptCount > 0 && onConfirm(pendingDeletePrompts)}
    />
  );
}
