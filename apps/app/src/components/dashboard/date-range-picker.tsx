import type { DateRange } from "react-day-picker";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DatePickerWithRangeProps = {
  className?: string;
  date: DateRange | undefined;
  setDate: (value: DateRange | undefined) => void;
  period: string;
  setPeriod: (value: string) => void;
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

export function DatePickerWithRange({
  className,
  date,
  setDate,
  period,
  setPeriod,
}: DatePickerWithRangeProps) {
  return (
    <FieldGroup className={cn("gap-2", className)}>
      <Field className="gap-1">
        <Select
          value={period}
          onValueChange={(next) => {
            setPeriod(next);
            if (next !== "custom") {
              setDate(undefined);
            }
          }}
        >
          <SelectTrigger className="h-10 w-full lg:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="item-aligned">
            <SelectGroup>
              <SelectItem value="today">Today (24h)</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      {period === "custom" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="date"
            className="h-10 lg:h-9"
            value={toDateInputValue(date?.from)}
            onChange={(event) => {
              const from = fromDateInputValue(event.target.value);
              setDate(from ? { from, to: date?.to } : undefined);
            }}
          />
          <Input
            type="date"
            className="h-10 lg:h-9"
            value={toDateInputValue(date?.to)}
            onChange={(event) => {
              const to = fromDateInputValue(event.target.value);
              setDate(date?.from ? { from: date.from, to } : to ? { from: to, to } : undefined);
            }}
          />
        </div>
      ) : null}
    </FieldGroup>
  );
}
