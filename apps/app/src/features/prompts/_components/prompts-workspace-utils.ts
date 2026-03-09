import { PromptItem, PeriodKey, PromptSchedule, Stage } from "./types";

export const PERIOD_TO_MINUTES: Record<PeriodKey, number> = {
  today: 24 * 60,
  "7d": 7 * 24 * 60,
  "14d": 14 * 24 * 60,
  "30d": 30 * 24 * 60,
  "90d": 90 * 24 * 60,
  custom: 90 * 24 * 60,
};

export const STAGES: Stage[] = ["Awareness", "Consideration", "Decision"];
export const DEFAULT_PROMPT_CRON = "0 */6 * * *";
export const DEFAULT_PROMPT_TIMEZONE = "UTC";

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

export function defaultPromptSchedule(): PromptSchedule {
  return {
    mode: "global",
    cron: DEFAULT_PROMPT_CRON,
    timezone: DEFAULT_PROMPT_TIMEZONE,
    modelCrons: {},
  };
}

export function isValidCronExpression(value: string) {
  const fields = value.trim().split(/\s+/).filter(Boolean);
  if (fields.length !== 5) return false;
  return fields.every((field) => /^[0-9*/,\-]+$/.test(field));
}

function formatHourMinute(hour: number, minute: number) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function describeCron(cron: string) {
  const value = cron.trim();
  if (value === "0 * * * *") return "Every hour";

  const everyHours = /^0 \*\/(\d+) \* \* \*$/.exec(value);
  if (everyHours) {
    return `Every ${everyHours[1]} hours`;
  }

  const daily = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(value);
  if (daily) {
    return `Every day at ${formatHourMinute(Number(daily[2]), Number(daily[1]))}`;
  }

  const weekdays = /^(\d{1,2}) (\d{1,2}) \* \* 1-5$/.exec(value);
  if (weekdays) {
    return `Weekdays at ${formatHourMinute(Number(weekdays[2]), Number(weekdays[1]))}`;
  }

  return "Custom cron";
}

export function promptScheduleLabel(schedule: PromptSchedule, cronOverride?: string) {
  const cron = (cronOverride || schedule.cron || DEFAULT_PROMPT_CRON).trim();
  const timezone = schedule.timezone?.trim() || DEFAULT_PROMPT_TIMEZONE;
  return `${describeCron(cron)} · ${timezone}`;
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
