import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ChecklistFilterOption = {
  id: string;
  label: ReactNode;
  meta?: ReactNode;
};

type ChecklistFilterSectionProps = {
  clearButtonClassName?: string;
  clearLabel: string;
  emptyLabel?: string;
  headerTitle: ReactNode;
  headerVariant?: "label" | "title";
  hiddenCount: number;
  onClear: () => void;
  onToggle: (id: string) => void;
  onToggleMore: () => void;
  options: readonly ChecklistFilterOption[];
  selectedIds: readonly string[];
  showAll: boolean;
  showLessLabel: string;
  showMoreLabel: string;
};

export function ChecklistFilterSection({
  clearButtonClassName,
  clearLabel,
  emptyLabel,
  headerTitle,
  headerVariant = "label",
  hiddenCount,
  onClear,
  onToggle,
  onToggleMore,
  options,
  selectedIds,
  showAll,
  showLessLabel,
  showMoreLabel,
}: ChecklistFilterSectionProps) {
  const title =
    headerVariant === "title" ? (
      <h4 className="min-w-0 text-sm font-semibold leading-tight text-foreground md:text-base lg:text-sm">
        {headerTitle}
      </h4>
    ) : (
      <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
        {headerTitle}
      </Label>
    );

  return (
    <div className={headerVariant === "title" ? "space-y-2" : "space-y-1.5"}>
      <div
        className={cn(
          "flex justify-between gap-2",
          headerVariant === "title" ? "items-start" : "items-center",
        )}
      >
        {title}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 justify-center px-3 text-xs lg:h-6 lg:px-2",
            selectedIds.length === 0 && "invisible pointer-events-none",
            clearButtonClassName,
          )}
          onClick={onClear}
        >
          {clearLabel}
        </Button>
      </div>

      <div className="space-y-2">
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);

          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-dashed px-3 py-3 lg:py-2",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:bg-muted/30",
              )}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggle(option.id)}
              />
              <span className="min-w-0 flex-1 break-words text-sm leading-tight md:text-[15px] lg:text-sm">
                {option.label}
              </span>
              {option.meta ? (
                <span className="text-[11px] tabular-nums text-muted-foreground md:text-xs lg:text-[11px]">
                  {option.meta}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      {options.length === 0 && emptyLabel ? (
        <EmptyStateCard label={emptyLabel} />
      ) : null}
      {hiddenCount > 0 ? (
        <Button
          variant="ghost"
          className="mt-1 min-h-9 w-full whitespace-normal py-2 text-xs leading-tight text-muted-foreground hover:text-foreground md:text-sm lg:min-h-7 lg:py-1 lg:text-xs"
          onClick={onToggleMore}
        >
          {showAll ? (
            <>
              {showLessLabel} <ChevronUp className="ml-1 h-3 w-3" />
            </>
          ) : (
            <>
              {showMoreLabel} ({hiddenCount}){" "}
              <ChevronDown className="ml-1 h-3 w-3" />
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}
