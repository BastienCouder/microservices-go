import type { PeriodFilterOption } from "@/components/shared/period-filter-picker";
import type { PerceptionSeverity } from "@/features/perception/_lib/shared/perception-data";
import type { OptimizationErrorSource } from "@/features/perception/_lib/shared/optimization-errors-data";
import { translateI18nText } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";

const locale = i18n.resolvedLanguage || i18n.language || "fr";

export const SEVERITY_COLUMNS: Array<{
  id: string;
  severity: PerceptionSeverity;
  title: string;
  tone: string;
}> = [
  {
    id: "high",
    severity: "high",
    title: translateI18nText("error-hub", "severityColumnHigh", locale),
    tone: "bg-destructive/10 text-destructive",
  },
  {
    id: "medium",
    severity: "medium",
    title: translateI18nText("error-hub", "severityColumnMedium", locale),
    tone: "bg-amber-500/10 text-amber-700",
  },
  {
    id: "low",
    severity: "low",
    title: translateI18nText("error-hub", "severityColumnLow", locale),
    tone: "bg-green-500/10 text-green-700",
  },
];

export const STATUS_COLUMNS = [
  {
    id: "todo",
    title: translateI18nText("error-hub", "statusColumnTodo", locale),
    tone: "bg-slate-500/10 text-slate-700",
  },
  {
    id: "processing",
    title: translateI18nText("error-hub", "statusColumnProcessing", locale),
    tone: "bg-sky-500/10 text-sky-700",
  },
  {
    id: "done",
    title: translateI18nText("error-hub", "statusColumnDone", locale),
    tone: "bg-emerald-500/10 text-emerald-700",
  },
] as const;

export type ErrorHubBoardView = "severity" | "status" | "content";
export type ErrorHubStatusColumnId = (typeof STATUS_COLUMNS)[number]["id"];

export const PERIOD_OPTIONS = [
  { value: "all", label: translateI18nText("error-hub", "periodOptionAll", locale) },
  { value: "7d", label: translateI18nText("error-hub", "periodOption7D", locale) },
  { value: "30d", label: translateI18nText("error-hub", "periodOption30D", locale) },
  { value: "90d", label: translateI18nText("error-hub", "periodOption90D", locale) },
] as const satisfies readonly PeriodFilterOption[];

export type PeriodFilter = (typeof PERIOD_OPTIONS)[number]["value"];

export const ACTION_STATUS_OPTIONS = [
  { value: "all", label: translateI18nText("error-hub", "actionStatusAll", locale) },
  { value: "processing", label: translateI18nText("error-hub", "actionStatusProcessing", locale) },
  { value: "done", label: translateI18nText("error-hub", "actionStatusDone", locale) },
] as const satisfies readonly PeriodFilterOption[];

export type ActionStatusFilter =
  (typeof ACTION_STATUS_OPTIONS)[number]["value"];

export const SOURCE_OPTIONS = [
  { value: "all", label: translateI18nText("error-hub", "sourceAll", locale) },
  { value: "crawler", label: translateI18nText("error-hub", "sourceCrawler", locale) },
  { value: "perception", label: translateI18nText("error-hub", "sourcePerception", locale) },
  { value: "monitoring", label: translateI18nText("error-hub", "sourceMonitoring", locale) },
] as const satisfies readonly PeriodFilterOption[];

export type SourceFilter = "all" | OptimizationErrorSource;
