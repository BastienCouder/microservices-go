import type { DateRange } from "react-day-picker";
import { useMemo } from "react";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { PeriodFilterOption, PeriodFilterPicker } from "./period-filter-picker";

type DatePickerWithRangeProps = {
  className?: string;
  date: DateRange | undefined;
  setDate: (value: DateRange | undefined) => void;
  period: string;
  setPeriod: (value: string) => void;
  includeAll?: boolean;
};

const PERIOD_OPTION_KEYS = [
  ["today", "today"],
  ["7d", "days7"],
  ["14d", "days14"],
  ["30d", "days30"],
  ["90d", "months3"],
  ["180d", "months6"],
  ["365d", "year1"],
  ["ytd", "yearToDate"],
  ["custom", "custom"],
] as const;

export const MONITORING_PERIOD_OPTIONS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "14d", label: "14 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "3 mois" },
  { value: "180d", label: "6 mois" },
  { value: "365d", label: "1 an" },
  { value: "ytd", label: "Cette année" },
  { value: "custom", label: "Personnalisée" },
] as const satisfies readonly PeriodFilterOption[];

function getMonitoringPeriodOptions(
  content: Record<string, string>,
  includeAll = false,
): readonly PeriodFilterOption[] {
  const options = PERIOD_OPTION_KEYS.map(([value, key]) => ({
    value,
    label: content[key],
  }));

  return includeAll
    ? [{ value: "all", label: content.allTime }, ...options]
    : options;
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
  period,
  setPeriod,
  includeAll = false,
}: DatePickerWithRangeProps) {
  const content = useI18nScope("monitoring-filters-panel");

  const options = useMemo(
    () => getMonitoringPeriodOptions(content, includeAll),
    [content, includeAll],
  );

  return (
    <PeriodFilterPicker
      className={className}
      value={period}
      onValueChange={setPeriod}
      options={options}
      date={date}
      onDateChange={setDate}
    />
  );
}