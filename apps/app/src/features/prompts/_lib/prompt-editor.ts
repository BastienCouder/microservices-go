import { translateI18nText } from "@/shared/hooks/use-i18n";

import { defaultPromptSchedule, promptScheduleLabel } from "./utils";
import type { AIModel, PromptItem, PromptSchedule } from "./types";

export const GLOBAL_CADENCE_PRESETS = [
  { id: "6h", labelKey: "preset6hLabel", cron: "0 */6 * * *" },
  { id: "daily", labelKey: "presetDaily0900Label", cron: "0 9 * * *" },
  { id: "twice-weekly", labelKey: "presetTwiceWeeklyLabel", cron: "0 9 * * 1,4" },
  { id: "weekends", labelKey: "presetWeekendsLabel", cron: "30 8 * * 6,0" },
];

export const PROMPT_STATUS_OPTIONS: Array<{
  value: PromptItem["status"];
}> = [
  { value: "active" },
  { value: "disabled" },
  { value: "archived" },
];

export const PROMPT_MAX_LENGTH = 500;

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
  const modelCrons = Object.fromEntries(
    Object.entries(schedule.modelCrons ?? {}).filter(
      ([modelId, cron]) => allowed.has(modelId) && cron.trim() !== "",
    ),
  );

  return {
    mode: schedule.mode === "per_model" ? "per_model" : "global",
    cron: schedule.cron.trim() || defaultPromptSchedule().cron,
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
