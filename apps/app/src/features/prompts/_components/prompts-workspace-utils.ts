import { PromptItem, PeriodKey, Stage } from "./types";

export const PERIOD_TO_MINUTES: Record<PeriodKey, number> = {
  today: 24 * 60,
  "7d": 7 * 24 * 60,
  "14d": 14 * 24 * 60,
  "30d": 30 * 24 * 60,
  "90d": 90 * 24 * 60,
  custom: 90 * 24 * 60,
};

export const STAGES: Stage[] = ["Awareness", "Consideration", "Decision"];

export function normalizeModelName(value: string) {
  return value.trim().toLowerCase();
}

export function parseRelativeTimeToMinutes(value: string) {
  const input = value.trim().toLowerCase();
  const numeric = Number.parseInt(input, 10);
  if (Number.isNaN(numeric)) return 60;
  if (input.endsWith("m")) return numeric;
  if (input.endsWith("h")) return numeric * 60;
  if (input.endsWith("d")) return numeric * 24 * 60;
  return numeric;
}

export function truncate(value: string, max = 36) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function statusBadgeVariant(status: PromptItem["status"]): "secondary" | "outline" | "destructive" {
  if (status === "active") return "secondary";
  if (status === "disabled") return "outline";
  return "destructive";
}

export function rankTone(rank: number) {
  if (rank <= 1.5) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (rank <= 3) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-rose-100 text-rose-700 border-rose-200";
}
