export const MONITORING_PERIOD_OPTIONS = [
  {
    value: "today",
    label: "24h",
    description: "Aujourd'hui",
  },
  {
    value: "7d",
    label: "7j",
    description: "Semaine",
  },
  {
    value: "14d",
    label: "14j",
    description: "2 semaines",
  },
  {
    value: "30d",
    label: "30j",
    description: "Mois",
  },
  {
    value: "90d",
    label: "90j",
    description: "Trimestre",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Dates",
  },
] as const;

export function getMonitoringPeriodLabel(value: string): string {
  return MONITORING_PERIOD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
