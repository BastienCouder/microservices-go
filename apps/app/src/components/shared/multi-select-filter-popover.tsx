import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MultiSelectFilterOption = {
  id: string;
  label: string;
  description?: ReactNode;
  iconSrc?: string | null;
  imageAlt?: string;
};

type MultiSelectFilterAllOption = {
  label: string;
  selected: boolean;
  onSelect: () => void;
};

type MultiSelectFilterPopoverProps = {
  label: string;
  summaryLabel: string;
  title: string;
  options: readonly MultiSelectFilterOption[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  allOption?: MultiSelectFilterAllOption;
  align?: "start" | "center" | "end";
  className?: string;
  contentClassName?: string;
  emptyLabel?: string;
  gridClassName?: string;
  loading?: boolean;
  loadingItemCount?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  showIconSlot?: boolean;
};

function SelectionDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
        selected ? "bg-primary" : "bg-muted-foreground/30",
      )}
    />
  );
}

function OptionCard({
  description,
  iconSrc,
  imageAlt,
  label,
  onClick,
  selected,
  showIconSlot,
}: {
  description?: ReactNode;
  iconSrc?: string | null;
  imageAlt?: string;
  label: string;
  onClick: () => void;
  selected: boolean;
  showIconSlot: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary/30 bg-primary/10"
          : "border-border/70 bg-background hover:bg-muted/30",
      )}
    >
      {showIconSlot ? (
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border p-2",
            selected
              ? "border-primary/30 bg-primary/10"
              : "border-border/50 bg-background",
          )}
        >
          {iconSrc ? (
            <img
              src={iconSrc}
              alt={imageAlt ?? label}
              className="h-full w-full object-contain opacity-85"
              decoding="async"
            />
          ) : (
            <span className="h-full w-full rounded-full bg-muted-foreground/30" />
          )}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold leading-tight",
            selected ? "text-primary" : "text-foreground",
          )}
        >
          {label}
        </span>
        {description ? (
          <span
            className={cn(
              "mt-1 block line-clamp-1 text-xs leading-snug",
              selected ? "text-primary/75" : "text-muted-foreground",
            )}
          >
            {description}
          </span>
        ) : null}
      </span>

      <SelectionDot selected={selected} />
    </button>
  );
}

function LoadingOptions({
  count,
  showIconSlot,
}: {
  count: number;
  showIconSlot: boolean;
}) {
  return Array.from({ length: count }).map((_, index) => (
    <div
      key={index}
      className="relative flex items-start gap-2 rounded-lg border border-border/70 p-3"
    >
      {showIconSlot ? <Skeleton className="h-9 w-9 rounded-lg" /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40 max-w-full" />
      </div>
      <Skeleton className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
    </div>
  ));
}

export function MultiSelectFilterPopover({
  align = "start",
  allOption,
  className,
  contentClassName,
  emptyLabel = "Aucune option disponible",
  gridClassName,
  label,
  loading = false,
  loadingItemCount = 4,
  onOpenChange,
  onToggle,
  open,
  options,
  selectedIds,
  showIconSlot = false,
  summaryLabel,
  title,
}: MultiSelectFilterPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-between rounded-lg border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[220px]",
            className,
          )}
          title={summaryLabel}
        >
          <span className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {loading ? (
              <Skeleton className="h-4 w-24 rounded-full" />
            ) : (
              <span className="truncate text-sm font-medium text-foreground">
                {summaryLabel}
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className={cn("w-[560px] max-w-[92vw] rounded-xl p-0", contentClassName)}
      >
        <FloatingPanelHeader title={title} />

        <div
          className={cn(
            "grid grid-cols-1 gap-2 px-4 pb-4 pt-1 sm:grid-cols-2",
            gridClassName,
          )}
        >
          {allOption ? (
            <OptionCard
              label={allOption.label}
              selected={allOption.selected}
              onClick={allOption.onSelect}
              showIconSlot={false}
            />
          ) : null}

          {loading ? (
            <LoadingOptions
              count={loadingItemCount}
              showIconSlot={showIconSlot}
            />
          ) : options.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
              {emptyLabel}
            </div>
          ) : (
            options.map((option) => (
              <OptionCard
                key={option.id}
                label={option.label}
                description={option.description}
                iconSrc={option.iconSrc}
                imageAlt={option.imageAlt}
                selected={selectedIds.includes(option.id)}
                onClick={() => onToggle(option.id)}
                showIconSlot={showIconSlot}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
