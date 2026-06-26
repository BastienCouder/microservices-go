import type { DateRange } from "react-day-picker";
import { useMemo, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

export type PeriodFilterOption = {
  value: string;
  label: string;
};

type PeriodFilterPickerProps = {
  className?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly PeriodFilterOption[];
  label?: string;
  title?: string;
  date?: DateRange | undefined;
  onDateChange?: (value: DateRange | undefined) => void;
  customValue?: string;
};

function toDateInputValue(value: Date | undefined): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function PeriodFilterPicker({
  className,
  value,
  onValueChange,
  options,
  title,
  date,
  onDateChange,
  customValue = "custom",
}: PeriodFilterPickerProps) {
  const content = useI18nScope("monitoring-filters-panel");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  const showCustomDates =
    value === customValue && typeof onDateChange === "function";

  const effectiveTitle = title ?? content.period;

  const handleOptionClick = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      if (nextValue !== customValue) {
        onDateChange?.(undefined);
      }
    },
    [customValue, onDateChange, onValueChange],
  );

  const handleFromChange = useCallback(
    (rawValue: string) => {
      const from = fromDateInputValue(rawValue);
      onDateChange?.(from ? { from, to: date?.to } : undefined);
    },
    [date?.to, onDateChange],
  );

  const handleToChange = useCallback(
    (rawValue: string) => {
      const to = fromDateInputValue(rawValue);

      if (!to) {
        onDateChange?.(date?.from ? { from: date.from, to: undefined } : undefined);
        return;
      }

      onDateChange?.(date?.from ? { from: date.from, to } : { from: to, to });
    },
    [date?.from, onDateChange],
  );

  return (
    <FieldGroup className={cn("gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-8 w-full justify-between rounded-lg border-border/80 bg-background px-4 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
              <span className="h-1 w-1 shrink-0 rounded-full bg-primary/50" />
              <span className="truncate text-sm font-medium text-foreground">
                {selectedOption?.label ?? value}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[min(92vw,24rem)] rounded-xl p-0">
          <FloatingPanelHeader title={effectiveTitle} />

          <div className="space-y-3 px-4 pb-4 pt-1">
            <div className="grid grid-cols-2 gap-2 space-y-1">
              {options.map((option) => {
                const active = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionClick(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]"
                        : "border-border/70 bg-background text-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                        active
                          ? "bg-primary"
                          : "border border-border/70 bg-transparent",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {showCustomDates ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    type="date"
                    className="h-10 bg-background lg:h-9"
                    value={toDateInputValue(date?.from)}
                    onChange={(event) => handleFromChange(event.target.value)}
                  />
                  <Input
                    type="date"
                    className="h-10 bg-background lg:h-9"
                    value={toDateInputValue(date?.to)}
                    onChange={(event) => handleToChange(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </FieldGroup>
  );
}
