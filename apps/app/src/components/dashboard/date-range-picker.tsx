import type { DateRange } from "react-day-picker";

import { Input } from "@/components/ui/input";

type DatePickerWithRangeProps = {
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
  date,
  setDate,
  period,
  setPeriod,
}: DatePickerWithRangeProps) {
  return (
    <div className="space-y-2">
      <select
        className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
        value={period}
        onChange={(event) => {
          const next = event.target.value;
          setPeriod(next);
          if (next !== "custom") {
            setDate(undefined);
          }
        }}
      >
        <option value="today">Today (24h)</option>
        <option value="7d">Last 7 days</option>
        <option value="14d">Last 14 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 3 months</option>
        <option value="custom">Custom range</option>
      </select>

      {period === "custom" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="date"
            value={toDateInputValue(date?.from)}
            onChange={(event) => {
              const from = fromDateInputValue(event.target.value);
              setDate(from ? { from, to: date?.to } : undefined);
            }}
          />
          <Input
            type="date"
            value={toDateInputValue(date?.to)}
            onChange={(event) => {
              const to = fromDateInputValue(event.target.value);
              setDate(date?.from ? { from: date.from, to } : to ? { from: to, to } : undefined);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
