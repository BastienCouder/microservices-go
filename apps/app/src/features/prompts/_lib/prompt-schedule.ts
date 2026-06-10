import { translateI18nText } from "@/shared/hooks/use-i18n";

import type { ModelVisual, PromptSchedule } from "./types";
import { isValidCronExpression, promptScheduleLabel } from "./utils";

export const GLOBAL_PRESETS = [
  {
    id: "hourly",
    labelKey: "schedulePresetHourlyLabel",
    noteKey: "schedulePresetHourlyNote",
    cron: "0 * * * *",
  },
  {
    id: "6h",
    labelKey: "schedulePreset6hLabel",
    noteKey: "schedulePreset6hNote",
    cron: "0 */6 * * *",
  },
  {
    id: "daily",
    labelKey: "schedulePresetDailyLabel",
    noteKey: "schedulePresetDailyNote",
    cron: "0 9 * * *",
  },
  {
    id: "weekdays",
    labelKey: "schedulePresetWeekdaysLabel",
    noteKey: "schedulePresetWeekdaysNote",
    cron: "30 8 * * 1-5",
  },
];

export const MODEL_PRESETS = [
  { id: "fast", labelKey: "modelPresetFastLabel", cron: "0 */2 * * *" },
  { id: "steady", labelKey: "modelPresetSteadyLabel", cron: "0 */6 * * *" },
  { id: "daily", labelKey: "modelPresetDailyLabel", cron: "0 9 * * *" },
];

export function normalizeSchedule(schedule: PromptSchedule, selectedModels: string[]): PromptSchedule {
  const allowed = new Set(selectedModels);
  const cron = schedule.cron.trim();
  const modelCrons = Object.fromEntries(
    Object.entries(schedule.modelCrons ?? {}).filter(
      ([modelId, modelCron]) =>
        allowed.has(modelId) && modelCron.trim() !== "" && modelCron.trim() !== cron,
    ),
  );

  return {
    mode: schedule.mode === "per_model" ? "per_model" : "global",
    cron,
    timezone: schedule.timezone.trim() || "UTC",
    modelCrons: schedule.mode === "per_model" ? modelCrons : {},
  };
}

export function isKnownPreset(cron: string, presets: { cron: string }[]) {
  return presets.some((preset) => preset.cron === cron.trim());
}

export function buildScheduleValidation(draft: PromptSchedule) {
  const validGlobalCron = isValidCronExpression(draft.cron);
  const invalidOverride = Object.entries(draft.modelCrons).find(
    ([, cron]) => cron.trim() !== "" && !isValidCronExpression(cron),
  );
  return {
    validGlobalCron,
    invalidOverride,
    isValid: validGlobalCron && !invalidOverride,
  };
}

export function buildScheduleHeaderSummary(draft: PromptSchedule, locale = "en") {
  const overridesCount = Object.keys(draft.modelCrons).length;
  return {
    overridesCount,
    cadenceLabel: promptScheduleLabel(draft, undefined, locale),
    overridesLabel:
      draft.mode === "global"
        ? translateI18nText("prompts-workspace", "cadenceModeGlobal", locale)
        : translateI18nText("prompts-workspace", "customAiCount", locale, {
            count: overridesCount,
          }),
  };
}

export type PromptScheduleVisual = {
  model: string;
  visual: ModelVisual;
  overrideCron: string;
  hasOverride: boolean;
  validOverride: boolean;
};
