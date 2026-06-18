import { translateI18nText } from "@/shared/hooks/use-i18n";

import { defaultPromptSchedule, promptScheduleLabel } from "./utils";
import type { AIModel, PromptItem, PromptSchedule } from "./types";

export const GLOBAL_CADENCE_PRESETS = [
  { id: "daily", labelKey: "presetDaily0900Label", cron: "0 9 * * *" },
  { id: "every-two-days", labelKey: "presetEveryTwoDaysLabel", cron: "0 9 */2 * *" },
  { id: "weekly", labelKey: "presetWeeklyLabel", cron: "0 9 * * 1" },
  { id: "twice-weekly", labelKey: "presetTwiceWeeklyLabel", cron: "0 9 * * 1,4" },
];

export const PROMPT_TIMEZONE_OPTIONS = [
  { value: "UTC", labelKey: "timezoneUtcLabel" },
  { value: "Europe/Paris", labelKey: "timezoneParisLabel" },
  { value: "Europe/London", labelKey: "timezoneLondonLabel" },
  { value: "Europe/Berlin", labelKey: "timezoneBerlinLabel" },
  { value: "Europe/Madrid", labelKey: "timezoneMadridLabel" },
  { value: "America/New_York", labelKey: "timezoneNewYorkLabel" },
  { value: "America/Toronto", labelKey: "timezoneTorontoLabel" },
  { value: "America/Chicago", labelKey: "timezoneChicagoLabel" },
  { value: "America/Los_Angeles", labelKey: "timezoneLosAngelesLabel" },
  { value: "America/Sao_Paulo", labelKey: "timezoneSaoPauloLabel" },
  { value: "Asia/Dubai", labelKey: "timezoneDubaiLabel" },
  { value: "Asia/Kolkata", labelKey: "timezoneKolkataLabel" },
  { value: "Asia/Singapore", labelKey: "timezoneSingaporeLabel" },
  { value: "Asia/Tokyo", labelKey: "timezoneTokyoLabel" },
  { value: "Australia/Sydney", labelKey: "timezoneSydneyLabel" },
];

export const CADENCE_DAY_OPTIONS = [
  { value: "1", labelKey: "dayMonday" },
  { value: "2", labelKey: "dayTuesday" },
  { value: "3", labelKey: "dayWednesday" },
  { value: "4", labelKey: "dayThursday" },
  { value: "5", labelKey: "dayFriday" },
  { value: "6", labelKey: "daySaturday" },
  { value: "0", labelKey: "daySunday" },
] as const;

export type CadenceBuilderKind =
  | "daily"
  | "every_two_days"
  | "selected_days"
  | "custom";

export type CadenceBuilderValue = {
  kind: CadenceBuilderKind;
  time: string;
  selectedDays: string[];
  customCron: string;
};

export const DEFAULT_CADENCE_BUILDER: CadenceBuilderValue = {
  kind: "daily",
  time: "09:00",
  selectedDays: ["1", "4"],
  customCron: "0 9 * * *",
};

export const CADENCE_TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

function parseCronTimeParts(cron: string) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour] = parts;
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return null;
  return {
    minute: Number(minute),
    hour: Number(hour),
    time: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
  };
}

export function cronToCadenceBuilder(cron: string): CadenceBuilderValue {
  const normalizedCron = cron.trim();
  const timeParts = parseCronTimeParts(normalizedCron);
  if (!timeParts) {
    return { ...DEFAULT_CADENCE_BUILDER, kind: "custom", customCron: normalizedCron || DEFAULT_CADENCE_BUILDER.customCron };
  }

  if (/^\d{1,2} \d{1,2} \* \* \*$/.test(normalizedCron)) {
    return {
      ...DEFAULT_CADENCE_BUILDER,
      kind: "daily",
      time: timeParts.time,
      customCron: normalizedCron,
    };
  }

  if (/^\d{1,2} \d{1,2} \*\/2 \* \*$/.test(normalizedCron)) {
    return {
      ...DEFAULT_CADENCE_BUILDER,
      kind: "every_two_days",
      time: timeParts.time,
      customCron: normalizedCron,
    };
  }

  const selectedDaysMatch = /^\d{1,2} \d{1,2} \* \* ([0-6](?:,[0-6])*)$/.exec(normalizedCron);
  if (selectedDaysMatch) {
    const selectedDays = Array.from(new Set(selectedDaysMatch[1].split(",")));
    if (selectedDays.length === 7) {
      return {
        ...DEFAULT_CADENCE_BUILDER,
        kind: "daily",
        time: timeParts.time,
        customCron: normalizedCron,
      };
    }

    return {
      ...DEFAULT_CADENCE_BUILDER,
      kind: "selected_days",
      time: timeParts.time,
      selectedDays,
      customCron: normalizedCron,
    };
  }

  return { ...DEFAULT_CADENCE_BUILDER, kind: "custom", customCron: normalizedCron || DEFAULT_CADENCE_BUILDER.customCron };
}

export function cadenceBuilderToCron(value: CadenceBuilderValue) {
  if (value.kind === "custom") return value.customCron.trim() || DEFAULT_CADENCE_BUILDER.customCron;

  const [hour = "09", minute = "00"] = value.time.split(":");
  const normalizedMinute = String(Number(minute)).padStart(2, "0");
  const normalizedHour = String(Number(hour)).padStart(2, "0");

  if (value.kind === "daily") return `${normalizedMinute} ${normalizedHour} * * *`;
  if (value.kind === "every_two_days") return `${normalizedMinute} ${normalizedHour} */2 * *`;
  const selectedDays = Array.from(new Set(value.selectedDays)).sort((left, right) => Number(left) - Number(right));
  if (selectedDays.length === 0) return `${normalizedMinute} ${normalizedHour} * * 1`;
  if (selectedDays.length === 7) return `${normalizedMinute} ${normalizedHour} * * *`;
  return `${normalizedMinute} ${normalizedHour} * * ${selectedDays.join(",")}`;
}

export const PROMPT_STATUS_OPTIONS: Array<{
  value: PromptItem["status"];
}> = [
  { value: "active" },
  { value: "disabled" },
  { value: "archived" },
];

export const PROMPT_MAX_LENGTH = 500;

export function getInitialModelOverrideCron(
  globalCron: string,
  presets: Array<{ cron: string }> = GLOBAL_CADENCE_PRESETS,
) {
  const normalizedGlobalCron = globalCron.trim();
  return (
    presets.find((preset) => preset.cron !== normalizedGlobalCron)?.cron ??
    normalizedGlobalCron
  );
}

export function getModelOverrideCron(
  globalCron: string,
  existingCron = "",
  presets: Array<{ cron: string }> = GLOBAL_CADENCE_PRESETS,
) {
  const normalizedGlobalCron = globalCron.trim();
  const normalizedExistingCron = existingCron.trim();
  if (normalizedExistingCron !== "" && normalizedExistingCron !== normalizedGlobalCron) {
    return normalizedExistingCron;
  }
  return getInitialModelOverrideCron(normalizedGlobalCron, presets);
}

export function getPromptStatusLabel(status: PromptItem["status"], locale = "en") {
  if (status === "active") return translateI18nText("prompts-workspace", "statusActive", locale);
  if (status === "disabled") return translateI18nText("prompts-workspace", "statusDisabled", locale);
  return translateI18nText("prompts-workspace", "statusArchived", locale);
}

export function normalizeEditorSchedule(
  schedule: PromptSchedule,
  selectedModels: AIModel[],
): PromptSchedule {
  const allowed = new Set(selectedModels);
  const cron = schedule.cron.trim() || defaultPromptSchedule().cron;
  const modelCrons = Object.fromEntries(
    Object.entries(schedule.modelCrons ?? {}).filter(
      ([modelId, modelCron]) =>
        allowed.has(modelId) && modelCron.trim() !== "" && modelCron.trim() !== cron,
    ),
  );

  return {
    mode: schedule.mode === "per_model" ? "per_model" : "global",
    cron,
    timezone: schedule.timezone.trim() || defaultPromptSchedule().timezone,
    modelCrons: schedule.mode === "per_model" ? modelCrons : {},
  };
}

export function buildEditorCadenceSummary(schedule: PromptSchedule, locale = "en") {
  const overridesCount = Object.keys(schedule.modelCrons).length;
  return {
    overridesCount,
    cadenceModeLabel:
      schedule.mode === "global"
        ? translateI18nText("prompts-workspace", "cadenceModeGlobal", locale)
        : translateI18nText("prompts-workspace", "cadenceModePerAi", locale),
    scheduleLabel: promptScheduleLabel(schedule, undefined, locale),
    badgeLabel:
      schedule.mode === "global"
        ? translateI18nText("prompts-workspace", "cadenceModeGlobal", locale)
        : translateI18nText("prompts-workspace", "customAiCount", locale, {
            count: overridesCount,
          }),
  };
}
