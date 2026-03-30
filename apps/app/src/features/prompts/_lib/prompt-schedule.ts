import type { ModelVisual, PromptSchedule } from "./types";
import { isValidCronExpression, promptScheduleLabel } from "./utils";

export const GLOBAL_PRESETS = [
  { id: "hourly", label: "Every hour", cron: "0 * * * *", note: "High-frequency monitoring" },
  { id: "6h", label: "Every 6 hours", cron: "0 */6 * * *", note: "Balanced baseline" },
  { id: "daily", label: "Every day at 09:00", cron: "0 9 * * *", note: "Morning snapshot" },
  { id: "weekdays", label: "Weekdays at 08:30", cron: "30 8 * * 1-5", note: "Business rhythm" },
];

export const MODEL_PRESETS = [
  { id: "fast", label: "Every 2 hours", cron: "0 */2 * * *" },
  { id: "steady", label: "Every 6 hours", cron: "0 */6 * * *" },
  { id: "daily", label: "Every day at 09:00", cron: "0 9 * * *" },
];

export function normalizeSchedule(schedule: PromptSchedule, selectedModels: string[]): PromptSchedule {
  const allowed = new Set(selectedModels);
  const modelCrons = Object.fromEntries(
    Object.entries(schedule.modelCrons ?? {}).filter(
      ([modelId, cron]) => allowed.has(modelId) && cron.trim() !== "",
    ),
  );

  return {
    mode: schedule.mode === "per_model" ? "per_model" : "global",
    cron: schedule.cron.trim(),
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

export function buildScheduleHeaderSummary(draft: PromptSchedule) {
  const overridesCount = Object.keys(draft.modelCrons).length;
  return {
    overridesCount,
    cadenceLabel: promptScheduleLabel(draft),
    overridesLabel:
      draft.mode === "global"
        ? "Global cadence"
        : `${overridesCount} AI override${overridesCount > 1 ? "s" : ""}`,
  };
}

export type PromptScheduleVisual = {
  model: string;
  visual: ModelVisual;
  overrideCron: string;
  hasOverride: boolean;
  validOverride: boolean;
};
