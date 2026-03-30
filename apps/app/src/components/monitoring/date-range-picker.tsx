import type { DateRange } from "react-day-picker";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerWithRangeProps = {
  className?: string;
  date: DateRange | undefined;
  setDate: (value: DateRange | undefined) => void;
  period: string;
  setPeriod: (value: string) => void;
};

const PERIOD_OPTIONS = [
  {
    value: "today",
    label: "Aujourd'hui",
  },
  {
    value: "7d",
    label: "7 jours",
  },
  {
    value: "14d",
    label: "14 jours",
  },
  {
    value: "30d",
    label: "30 jours",
  },
  {
    value: "90d",
    label: "3 mois",
  },
  {
    value: "180d",
    label: "6 mois",
  },
  {
    value: "365d",
    label: "1 an",
  },
  {
    value: "ytd",
    label: "Cette annee",
  },
  {
    value: "custom",
    label: "Personnalisee",
  },
] as const;

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

export function DatePickerWithRange({
  className,
  date,
  setDate,
  period,
  setPeriod,
}: DatePickerWithRangeProps) {
  const selectedOption =
    PERIOD_OPTIONS.find((option) => option.value === period) ?? PERIOD_OPTIONS[1]!;

  return (
    <FieldGroup className={cn("gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 sm:h-8"
          >
            <span className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Periode
              </span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="truncate text-sm font-medium text-foreground">
                {selectedOption.label}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[min(92vw,24rem)] p-0">
          <PopoverHeader className="px-4 pt-4">
            <PopoverTitle>Periode</PopoverTitle>
            <PopoverDescription>Choisissez une plage.</PopoverDescription>
          </PopoverHeader>

          <div className="space-y-3 px-4 pb-4 pt-1">
            <div className="grid grid-cols-2 gap-2 space-y-1">
              {PERIOD_OPTIONS.map((option) => {
                const active = option.value === period;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPeriod(option.value);
                      if (option.value !== "custom") {
                        setDate(undefined);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/40",
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                        active ? "bg-primary" : "bg-transparent border border-border/70",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {period === "custom" ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    type="date"
                    className="h-10 bg-background lg:h-9"
                    value={toDateInputValue(date?.from)}
                    onChange={(event) => {
                      const from = fromDateInputValue(event.target.value);
                      setDate(from ? { from, to: date?.to } : undefined);
                    }}
                  />
                  <Input
                    type="date"
                    className="h-10 bg-background lg:h-9"
                    value={toDateInputValue(date?.to)}
                    onChange={(event) => {
                      const to = fromDateInputValue(event.target.value);
                      setDate(
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
