import type { PeriodFilterOption } from "@/components/shared/period-filter-picker";
import type { PerceptionSeverity } from "@/features/perception/_lib/shared/perception-data";
import type { OptimizationErrorSource } from "@/features/perception/_lib/shared/optimization-errors-data";

export const SEVERITY_COLUMNS: Array<{
  id: string;
  severity: PerceptionSeverity;
  title: string;
  tone: string;
}> = [
  {
    id: "high",
    severity: "high",
    title: "Critique",
    tone: "bg-destructive/10 text-destructive",
  },
  {
    id: "medium",
    severity: "medium",
    title: "Moyenne",
    tone: "bg-amber-500/10 text-amber-700",
  },
  {
    id: "low",
    severity: "low",
    title: "Faible",
    tone: "bg-green-500/10 text-green-700",
  },
];

export const STATUS_COLUMNS = [
  {
    id: "todo",
    title: "À faire",
    tone: "bg-slate-500/10 text-slate-700",
  },
  {
    id: "processing",
    title: "En cours",
    tone: "bg-sky-500/10 text-sky-700",
  },
  {
    id: "done",
    title: "Terminé",
    tone: "bg-emerald-500/10 text-emerald-700",
  },
] as const;

export type ErrorHubBoardView = "severity" | "status" | "content";
export type ErrorHubStatusColumnId = (typeof STATUS_COLUMNS)[number]["id"];

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
