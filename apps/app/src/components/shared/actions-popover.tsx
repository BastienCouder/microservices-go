import type { ComponentType } from "react";
import { MoreHorizontal } from "lucide-react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { cn } from "@/lib/utils";

type ActionIcon = ComponentType<{ className?: string }>;

export type ActionsPopoverItem = {
  icon: ActionIcon;
  title: string;
  description?: string;
  tone?: "default" | "destructive";
  disabled?: boolean;
  onSelect: () => void;
};

type ActionsPopoverProps = {
  title: string;
  description?: string;
  items: ActionsPopoverItem[];
  triggerLabel?: string;
  disabled?: boolean;
  contentClassName?: string;
  stopPropagation?: boolean;
};

function stopEventPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function ActionsPopoverItemView({
  icon: Icon,
  title,
  description,
  tone = "default",
  disabled = false,
  onSelect,
}: ActionsPopoverItem) {
  return (
    <DropdownMenuItem
      variant={tone}
      disabled={disabled}
      onSelect={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={cn(
        "cursor-pointer group min-h-[58px] items-center gap-3 rounded-2xl border bg-background px-3 py-3 focus:bg-muted/30",
        tone === "destructive"
          ? "border-rose-200/80 focus:border-rose-300 focus:bg-rose-50/80"
          : "border-border/70 focus:border-border",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors",
          tone === "destructive"
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : "border-border/70 bg-muted/25 text-muted-foreground group-focus:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", tone === "destructive" ? "text-rose-700" : "text-foreground")}>
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
          tone === "destructive" ? "bg-rose-400/80" : "bg-muted-foreground/25 group-focus:bg-primary/80",
        )}
        aria-hidden="true"
      />
    </DropdownMenuItem>
  );
}

export function ActionsPopover({
  title,
  items,
  triggerLabel,
  disabled = false,
  contentClassName,
  stopPropagation = true,
}: ActionsPopoverProps) {
  const { t } = useScopedI18n("shared-ui");
  const resolvedTriggerLabel = triggerLabel ?? t("actions");
  const propagationProps = stopPropagation
    ? {
        onClick: stopEventPropagation,
        onPointerDown: stopEventPropagation,
        onKeyDown: stopEventPropagation,
      }
    : {};

  return (
    <div {...propagationProps}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={stopPropagation ? stopEventPropagation : undefined}>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full border border-transparent hover:border-border/70 hover:bg-muted/50"
            disabled={disabled}
            title={resolvedTriggerLabel}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">{resolvedTriggerLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={cn("w-[340px] max-w-[92vw] p-0", contentClassName)}>
          <FloatingPanelHeader title={title} />
          <div className="space-y-2 px-4 py-4">
            {items.map((item) => (
              <ActionsPopoverItemView key={item.title} {...item} />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
