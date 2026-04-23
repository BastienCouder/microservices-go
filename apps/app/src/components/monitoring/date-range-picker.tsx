import type { DateRange } from "react-day-picker";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { PeriodFilterPicker, type PeriodFilterOption } from "./period-filter-picker";

type DatePickerWithRangeProps = {
  className?: string;
  date: DateRange | undefined;
  setDate: (value: DateRange | undefined) => void;
  period: string;
  setPeriod: (value: string) => void;
  includeAll?: boolean;
};

export const MONITORING_PERIOD_OPTIONS = [
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
    label: "Cette année",
  },
  {
    value: "custom",
    label: "Personnalisée",
  },
] as const satisfies readonly PeriodFilterOption[];

function getMonitoringPeriodOptions(
  content: Record<string, string>,
  includeAll = false,
): readonly PeriodFilterOption[] {
  const options: PeriodFilterOption[] = [
    { value: "today", label: content.today },
    { value: "7d", label: content.days7 },
    { value: "14d", label: content.days14 },
    { value: "30d", label: content.days30 },
    { value: "90d", label: content.months3 },
    { value: "180d", label: content.months6 },
    { value: "365d", label: content.year1 },
    { value: "ytd", label: content.yearToDate },
    { value: "custom", label: content.custom },
  ];

  if (includeAll) {
    return [{ value: "all", label: content.allTime }, ...options];
  }

  return options;
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

  return (
    <PeriodFilterPicker
      className={className}
      value={period}
      onValueChange={setPeriod}
      options={getMonitoringPeriodOptions(content, includeAll)}
      date={date}
      onDateChange={setDate}
    />
  );
}
