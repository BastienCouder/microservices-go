import { translateI18nText } from "@/shared/hooks/use-i18n";

type MonitoringPeriodOption = {
  value: string;
  label: string;
  description: string;
};

export function getMonitoringPeriodOptions(locale: string): readonly MonitoringPeriodOption[] {
  return [
    {
      value: "today",
      label: translateI18nText("monitoring-filters-panel", "periodShortToday", locale),
      description: translateI18nText("monitoring-filters-panel", "today", locale),
    },
    {
      value: "7d",
      label: translateI18nText("monitoring-filters-panel", "periodShort7d", locale),
      description: translateI18nText("monitoring-filters-panel", "days7", locale),
    },
    {
      value: "14d",
      label: translateI18nText("monitoring-filters-panel", "periodShort14d", locale),
      description: translateI18nText("monitoring-filters-panel", "days14", locale),
    },
    {
      value: "30d",
      label: translateI18nText("monitoring-filters-panel", "periodShort30d", locale),
      description: translateI18nText("monitoring-filters-panel", "days30", locale),
    },
    {
      value: "90d",
      label: translateI18nText("monitoring-filters-panel", "periodShort90d", locale),
      description: translateI18nText("monitoring-filters-panel", "months3", locale),
    },
    {
      value: "180d",
      label: translateI18nText("monitoring-filters-panel", "periodShort180d", locale),
      description: translateI18nText("monitoring-filters-panel", "months6", locale),
    },
    {
      value: "365d",
      label: translateI18nText("monitoring-filters-panel", "periodShort365d", locale),
      description: translateI18nText("monitoring-filters-panel", "year1", locale),
    },
    {
      value: "ytd",
      label: translateI18nText("monitoring-filters-panel", "periodShortYtd", locale),
      description: translateI18nText("monitoring-filters-panel", "yearToDate", locale),
    },
    {
      value: "custom",
      label: translateI18nText("monitoring-filters-panel", "periodShortCustom", locale),
      description: translateI18nText("monitoring-filters-panel", "custom", locale),
    },
  ] as const;
}

export function getMonitoringPeriodLabel(value: string, locale: string): string {
  return getMonitoringPeriodOptions(locale).find((option) => option.value === value)?.label ?? value;
}
