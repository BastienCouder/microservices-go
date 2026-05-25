import type { PeriodFilterOption } from "@/components/shared/period-filter-picker";
import type { PerceptionSeverity } from "@/lib/perception-data";
import type { OptimizationErrorSource } from "@/lib/optimization-errors-data";

export const SEVERITY_COLUMNS: Array<{
  severity: PerceptionSeverity;
  title: string;
  tone: string;
}> = [
  {
    severity: "high",
    title: "Critique",
    tone: "bg-destructive/10 text-destructive",
  },
  {
    severity: "medium",
    title: "Moyenne",
    tone: "bg-amber-500/10 text-amber-700",
  },
  {
    severity: "low",
    title: "Faible",
    tone: "bg-green-500/10 text-green-700",
  },
];

export const PERIOD_OPTIONS = [
  { value: "all", label: "Toutes les erreurs" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
] as const satisfies readonly PeriodFilterOption[];

export type PeriodFilter = (typeof PERIOD_OPTIONS)[number]["value"];

export const ACTION_STATUS_OPTIONS = [
  { value: "all", label: "Toutes les actions" },
  { value: "processing", label: "En cours" },
  { value: "done", label: "Terminées" },
] as const satisfies readonly PeriodFilterOption[];

export type ActionStatusFilter =
  (typeof ACTION_STATUS_OPTIONS)[number]["value"];

export const SOURCE_OPTIONS = [
  { value: "all", label: "Toutes les sources" },
  { value: "crawler", label: "Crawler" },
  { value: "perception", label: "Perception" },
  { value: "monitoring", label: "Monitoring" },
] as const satisfies readonly PeriodFilterOption[];

export type SourceFilter = "all" | OptimizationErrorSource;