"use client";

import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function buildConfirmDialogPreview(items: string[], limit = 5) {
  const visibleItems = items.slice(0, Math.max(0, limit));
  return {
    visibleItems,
    remainingCount: Math.max(0, items.length - visibleItems.length),
  };
}

type ConfirmDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onConfirm?: () => void;
  loading?: boolean;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  confirmVariant?: ComponentProps<typeof AlertDialogAction>["variant"];
  size?: ComponentProps<typeof AlertDialogContent>["size"];
  media?: ReactNode | null;
  previewItems?: string[];
  previewLimit?: number;
  previewOverflowLabel?: (remainingCount: number) => ReactNode;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  loading = false,
  confirmDisabled = false,
  cancelDisabled = false,
  confirmVariant = "destructive",
  size = "sm",
  media = <AlertTriangle />,
  previewItems = [],
  previewLimit = 5,
  previewOverflowLabel,
  children,
}: ConfirmDialogProps) {
  const preview = buildConfirmDialogPreview(previewItems, previewLimit);

  return (
    <AlertDialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent size={size}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
          {preview.visibleItems.length > 0 ? (
            <div className="mt-2 max-h-28 w-full overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3 text-left text-sm leading-6 break-words [overflow-wrap:anywhere]">
              <div className="space-y-1">
                {preview.visibleItems.map((item, index) => (
                  <div key={`${index}-${item}`}>{item}</div>
                ))}
                {preview.remainingCount > 0 ? (
                  <div className="text-muted-foreground">
                    {previewOverflowLabel
                      ? previewOverflowLabel(preview.remainingCount)
                      : `+${preview.remainingCount} more`}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {children}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading || cancelDisabled}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            disabled={loading || confirmDisabled}
            onClick={() => onConfirm?.()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
