import type { DateRange } from "react-day-picker";

import type {
  MonitoringAlert,
  MonitoringLoadFilters,
} from "./monitoring-data-types";

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function getPeriodRange(period: string, dateRange?: DateRange): { from: Date; to: Date } | null {
  const now = new Date();

  if (period === "custom") {
    if (!dateRange?.from) return null;
    return {
      from: startOfDay(dateRange.from),
      to: endOfDay(dateRange.to ?? dateRange.from),
    };
  }

  const from = new Date(now);
  if (period === "today" || period === "24h") from.setHours(from.getHours() - 24);
  else if (period === "14d") from.setDate(from.getDate() - 14);
  else if (period === "30d") from.setDate(from.getDate() - 30);
  else if (period === "90d") from.setDate(from.getDate() - 90);
  else from.setDate(from.getDate() - 7);

  return { from, to: now };
}

function alertMatchesDateScope(
  alert: Pick<MonitoringAlert, "createdAt">,
  period: string,
  dateRange: DateRange | undefined,
) {
  if (!alert.createdAt) {
    return period === "7d" && dateRange === undefined;
  }

  const createdAt = new Date(alert.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  if (period === "custom") {
    if (!dateRange?.from) return true;
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to ?? dateRange.from);
    return createdAt >= from && createdAt <= to;
  }

  const range = getPeriodRange(period);
  if (!range) return true;
  return createdAt >= range.from && createdAt <= range.to;
}

function alertMatchesAudienceScope(
  values: string[] | undefined,
  selected: string[],
) {
  if (selected.length === 0) {
    return true;
  }
  if (!values || values.length === 0) {
    return false;
  }

  const normalizedValues = values.map(normalizeFilterValue);
  return selected.some((value) => normalizedValues.includes(normalizeFilterValue(value)));
}

export function filterMonitoringAlerts(
  alerts: MonitoringAlert[],
  filters: MonitoringLoadFilters,
): MonitoringAlert[] {
  return alerts.filter((alert) => {
    if (!alertMatchesDateScope(alert, filters.period, filters.dateRange)) {
      return false;
    }

    return (
      alertMatchesAudienceScope(alert.modelIds, filters.selectedModels) &&
      alertMatchesAudienceScope(alert.personas, filters.selectedPersonas) &&
      alertMatchesAudienceScope(alert.competitors, filters.selectedCompetitors)
    );
  });
}

