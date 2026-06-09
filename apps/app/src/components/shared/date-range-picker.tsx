import type { DateRange } from "react-day-picker";
import { useMemo } from "react";
import i18n from "@/shared/i18n";
import { translateI18nText, useI18nScope } from "@/shared/hooks/use-i18n";
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
  { value: "today", label: translateI18nText("monitoring-filters-panel", "today", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "7d", label: translateI18nText("monitoring-filters-panel", "days7", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "14d", label: translateI18nText("monitoring-filters-panel", "days14", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "30d", label: translateI18nText("monitoring-filters-panel", "days30", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "90d", label: translateI18nText("monitoring-filters-panel", "months3", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "180d", label: translateI18nText("monitoring-filters-panel", "months6", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "365d", label: translateI18nText("monitoring-filters-panel", "year1", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "ytd", label: translateI18nText("monitoring-filters-panel", "yearToDate", i18n.resolvedLanguage || i18n.language || "fr") },
  { value: "custom", label: translateI18nText("monitoring-filters-panel", "custom", i18n.resolvedLanguage || i18n.language || "fr") },
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
