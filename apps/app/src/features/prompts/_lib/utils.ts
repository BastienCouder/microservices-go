import { translateI18nText } from "@/shared/hooks/use-i18n";

import type { PeriodKey, PromptItem, PromptSchedule, Stage } from "./types";

export const DEFAULT_PROMPT_PERIOD: PeriodKey = "all";

export const PERIOD_TO_MINUTES: Record<PeriodKey, number> = {
  all: Number.POSITIVE_INFINITY,
  today: 24 * 60,
  "7d": 7 * 24 * 60,
  "14d": 14 * 24 * 60,
  "30d": 30 * 24 * 60,
  "90d": 90 * 24 * 60,
  "180d": 180 * 24 * 60,
  "365d": 365 * 24 * 60,
  ytd: 365 * 24 * 60,
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
  return fields.every((field) => /^[0-9*/,-]+$/.test(field));
}

function formatHourMinute(hour: number, minute: number) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function describeCron(cron: string, locale = "en") {
  const value = cron.trim();
  if (value === "0 * * * *") return translateI18nText("prompts-workspace", "cronHourly", locale);
  if (value === "0 9 * * 1,4") return translateI18nText("prompts-workspace", "cronTwiceWeekly", locale);
  if (value === "30 8 * * 6,0") {
    return translateI18nText("prompts-workspace", "cronWeekendsAt", locale, {
      time: "08:30",
    });
  }

  const everyHours = /^0 \*\/(\d+) \* \* \*$/.exec(value);
  if (everyHours) {
    return translateI18nText("prompts-workspace", "cronEveryHours", locale, {
      count: Number(everyHours[1]),
    });
  }

  const daily = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(value);
  if (daily) {
    return translateI18nText("prompts-workspace", "cronEveryDayAt", locale, {
      time: formatHourMinute(Number(daily[2]), Number(daily[1])),
    });
  }

  const weekends = /^(\d{1,2}) (\d{1,2}) \* \* 6,0$/.exec(value);
  if (weekends) {
    return translateI18nText("prompts-workspace", "cronWeekendsAt", locale, {
      time: formatHourMinute(Number(weekends[2]), Number(weekends[1])),
    });
  }

  const weekdays = /^(\d{1,2}) (\d{1,2}) \* \* 1-5$/.exec(value);
  if (weekdays) {
    return translateI18nText("prompts-workspace", "cronWeekdaysAt", locale, {
      time: formatHourMinute(Number(weekdays[2]), Number(weekdays[1])),
    });
  }

  return translateI18nText("prompts-workspace", "cronCustom", locale);
}

export function promptScheduleLabel(
  schedule: PromptSchedule,
  cronOverride?: string,
  locale = "en",
) {
  const cron = (cronOverride || schedule.cron || DEFAULT_PROMPT_CRON).trim();
  const timezone = schedule.timezone?.trim() || DEFAULT_PROMPT_TIMEZONE;
  return translateI18nText("prompts-workspace", "scheduleFormat", locale, {
    description: describeCron(cron, locale),
    timezone,
  });
}

export function promptCadenceLabel(item: PromptItem, locale = "en") {
  const overridesCount = Object.keys(item.schedule.modelCrons).length;
  if (item.rowMode === "global" && item.schedule.mode === "per_model" && overridesCount > 0) {
    return translateI18nText("prompts-workspace", "customCadenceCount", locale, {
      count: overridesCount,
    });
  }
  return promptScheduleLabel(item.schedule, item.effectiveCron, locale);
}

export function promptStatusLabel(status: PromptItem["status"], locale = "en") {
  if (status === "active") return translateI18nText("prompts-workspace", "statusActive", locale);
  if (status === "disabled") return translateI18nText("prompts-workspace", "statusDisabled", locale);
  return translateI18nText("prompts-workspace", "statusArchived", locale);
}

export function promptStageLabel(stage: Stage, locale = "en") {
  if (stage === "Awareness") return translateI18nText("prompts-workspace", "stageAwareness", locale);
  if (stage === "Consideration") {
    return translateI18nText("prompts-workspace", "stageConsideration", locale);
  }
  return translateI18nText("prompts-workspace", "stageDecision", locale);
}

export function relativeRunLabel(minutes: number, locale = "en") {
  if (minutes < 60) {
    return translateI18nText("prompts-workspace", "runMinutesAgo", locale, { count: minutes });
  }
  return translateI18nText("prompts-workspace", "runHoursAgo", locale, {
    count: Math.floor(minutes / 60),
  });
}

export function statusBadgeClassName(status: PromptItem["status"]) {
  if (status === "active") return "border-transparent bg-emerald-50 text-emerald-700";
  if (status === "disabled") return "border-transparent bg-slate-100 text-slate-600";
  return "border-transparent bg-rose-50 text-rose-700";
}

export function rankTone(rank: number) {
  if (rank <= 1.5) return "bg-emerald-100 text-emerald-700 border-transparent";
  if (rank <= 3) return "bg-amber-100 text-amber-700 border-transparent";
  return "bg-rose-100 text-rose-700 border-transparent";
}
