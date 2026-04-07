"use client";

import type { DateRange } from "react-day-picker";

import { Input } from "@/components/ui/input";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type MobileCustomRangePanelProps = {
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
};

function toDateInputValue(value: Date | undefined): string {
  if (!value) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string): Date | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  const parsedDate = new Date(`${trimmedValue}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

export function MobileCustomRangePanel({
  value,
  onChange,
}: MobileCustomRangePanelProps) {
  const content = useI18nScope("monitoring-mobile");

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-950">{content.customRangeTitle}</p>
        <p className="text-xs text-slate-500">
          {content.customRangeDescription}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            {content.start}
          </span>
          <Input
            type="date"
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
            value={toDateInputValue(value?.from)}
            onChange={(event) => {
              const from = fromDateInputValue(event.target.value);
              onChange(from ? { from, to: value?.to } : undefined);
            }}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            {content.end}
          </span>
          <Input
            type="date"
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
            value={toDateInputValue(value?.to)}
            onChange={(event) => {
              const to = fromDateInputValue(event.target.value);
              onChange(value?.from ? { from: value.from, to } : to ? { from: to, to } : undefined);
            }}
          />
        </label>
      </div>
    </div>
  );
}
