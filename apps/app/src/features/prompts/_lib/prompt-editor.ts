import { defaultPromptSchedule, promptScheduleLabel } from "./utils";
import type { AIModel, PromptItem, PromptSchedule } from "./types";

export const GLOBAL_CADENCE_PRESETS = [
  { id: "6h", label: "Toutes les 6 heures", cron: "0 */6 * * *" },
  { id: "daily", label: "Chaque jour a 09:00", cron: "0 9 * * *" },
  { id: "twice-weekly", label: "Deux fois par semaine", cron: "0 9 * * 1,4" },
  { id: "weekends", label: "Tous les week-ends", cron: "30 8 * * 6,0" },
];

export const PROMPT_STATUS_OPTIONS: Array<{
  value: PromptItem["status"];
  label: string;
}> = [
  { value: "active", label: "Actif" },
  { value: "disabled", label: "Desactive" },
  { value: "archived", label: "Archive" },
];

export const PROMPT_MAX_LENGTH = 500;

export function getPromptStatusLabel(status: PromptItem["status"]) {
  if (status === "active") return "Actif";
  if (status === "disabled") return "Desactive";
  return "Archive";
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

export function buildEditorCadenceSummary(schedule: PromptSchedule) {
  const overridesCount = Object.keys(schedule.modelCrons).length;
  return {
    overridesCount,
    cadenceModeLabel: schedule.mode === "global" ? "Cadence globale" : "Cadence par IA",
    scheduleLabel: promptScheduleLabel(schedule),
    badgeLabel:
      schedule.mode === "global"
        ? "Cadence globale"
        : `${overridesCount} IA personnalisee${overridesCount > 1 ? "s" : ""}`,
  };
}
