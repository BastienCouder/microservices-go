import type { DateRange } from "react-day-picker";
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
  description?: string;
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
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export function PeriodFilterPicker({
  className,
  value,
  onValueChange,
  options,
  label = "Période",
  title = "Période",
  description = "Choisissez une plage.",
  date,
  onDateChange,
  customValue = "custom",
}: PeriodFilterPickerProps) {
  const content = useI18nScope("monitoring-filters-panel");
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const showCustomDates = value === customValue && typeof onDateChange === "function";
  const effectiveLabel =
    label === "Periode" || label === "Période" ? content.period : label;
  const effectiveTitle =
    title === "Periode" || title === "Période" ? content.period : title;
  const effectiveDescription =
    description === "Choisissez une plage." ? content.chooseRange : description;

  return (
    <FieldGroup className={cn("gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
              <span className="shrink-0 text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {effectiveLabel}
              </span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="truncate text-sm font-medium text-foreground">
                {selectedOption?.label ?? value}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[min(92vw,24rem)] p-0">
          <FloatingPanelHeader
            title={effectiveTitle}
            description={effectiveDescription}
          />

          <div className="space-y-3 px-4 pb-4 pt-1">
            <div className="grid grid-cols-2 gap-2 space-y-1">
              {options.map((option) => {
                const active = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onValueChange(option.value);
                      if (option.value !== customValue) {
                        onDateChange?.(undefined);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]"
                        : "border-border/70 bg-background text-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                        active ? "bg-primary" : "border border-border/70 bg-transparent",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {showCustomDates ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    type="date"
                    className="h-10 bg-background lg:h-9"
                    value={toDateInputValue(date?.from)}
                    onChange={(event) => {
                      const from = fromDateInputValue(event.target.value);
                      onDateChange(from ? { from, to: date?.to } : undefined);
                    }}
                  />
                  <Input
                    type="date"
                    className="h-10 bg-background lg:h-9"
                    value={toDateInputValue(date?.to)}
                    onChange={(event) => {
                      const to = fromDateInputValue(event.target.value);
                      onDateChange(
                        date?.from
                          ? { from: date.from, to }
                          : to
                            ? { from: to, to }
                            : undefined,
                      );
                    }}
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
