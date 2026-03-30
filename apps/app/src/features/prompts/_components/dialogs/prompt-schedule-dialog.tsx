"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  buildScheduleHeaderSummary,
  buildScheduleValidation,
  GLOBAL_PRESETS,
  MODEL_PRESETS,
  isKnownPreset,
  normalizeSchedule,
} from "../../_lib/prompt-schedule";
import type { ModelVisual, PromptSchedule } from "../../_lib/types";
import { isValidCronExpression } from "../../_lib/utils";
import {
  PromptScheduleBody,
  PromptScheduleHeader,
  PromptScheduleSidebar,
} from "./prompt-schedule-sections";

type PromptScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptLabel: string;
  schedule: PromptSchedule;
  selectedModels: string[];
  getModelVisual: (model: string) => ModelVisual;
  saving?: boolean;
  onSave: (schedule: PromptSchedule) => void;
};

export function PromptScheduleDialog({
  open,
  onOpenChange,
  promptLabel,
  schedule,
  selectedModels,
  getModelVisual,
  saving = false,
  onSave,
}: PromptScheduleDialogProps) {
  const [draft, setDraft] = useState<PromptSchedule>(schedule);
  const [showAdvancedCron, setShowAdvancedCron] = useState(false);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeSchedule(schedule, selectedModels);
    const hasCustomGlobalCron = !isKnownPreset(normalized.cron, GLOBAL_PRESETS);
    const hasCustomOverride = Object.values(normalized.modelCrons).some(
      (cron) => cron.trim() !== "" && !isKnownPreset(cron, MODEL_PRESETS),
    );
    setDraft(normalized);
    setShowAdvancedCron(hasCustomGlobalCron || hasCustomOverride);
  }, [open, schedule, selectedModels]);

  const headerSummary = buildScheduleHeaderSummary(draft);
  const validation = buildScheduleValidation(draft);
  const visibleModels = useMemo(
    () =>
      selectedModels.map((model) => {
        const overrideCron = draft.modelCrons[model] || "";
        return {
          model,
          visual: getModelVisual(model),
          overrideCron,
          hasOverride: overrideCron !== "",
          validOverride: overrideCron === "" || isValidCronExpression(overrideCron),
        };
      }),
    [draft.modelCrons, getModelVisual, selectedModels],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden !gap-0 !p-0 sm:!max-w-[1100px]">
        <PromptScheduleHeader
          draft={draft}
          promptLabel={promptLabel}
          overridesCount={headerSummary.overridesCount}
          overridesLabel={headerSummary.overridesLabel}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <PromptScheduleSidebar
              draft={draft}
              overridesCount={headerSummary.overridesCount}
              onSetMode={(mode) => setDraft((current) => ({ ...current, mode }))}
            />
            <PromptScheduleBody
              draft={draft}
              saving={saving}
              showAdvancedCron={showAdvancedCron}
              validGlobalCron={validation.validGlobalCron}
              visibleModels={visibleModels}
              onSetCron={(cron) => setDraft((current) => ({ ...current, cron }))}
              onSetTimezone={(timezone) => setDraft((current) => ({ ...current, timezone }))}
              onToggleAdvanced={setShowAdvancedCron}
              onToggleOverride={(modelId, enabled) =>
                setDraft((current) => {
                  const nextOverrides = { ...current.modelCrons };
                  if (enabled) {
                    nextOverrides[modelId] = nextOverrides[modelId] || current.cron;
                  } else {
                    delete nextOverrides[modelId];
                  }
                  return { ...current, modelCrons: nextOverrides };
                })
              }
              onUpdateOverride={(modelId, cron) =>
                setDraft((current) => ({
                  ...current,
                  modelCrons: { ...current.modelCrons, [modelId]: cron },
                }))
              }
            />
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={!validation.isValid || saving}
            onClick={() =>
              onSave(
                normalizeSchedule(
                  {
                    ...draft,
                    modelCrons: draft.mode === "per_model" ? draft.modelCrons : {},
                  },
                  selectedModels,
                ),
              )
            }
          >
            {saving ? "Saving..." : "Save cadence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
