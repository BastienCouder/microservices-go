"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/features/shared/view/page-header";
import {
  PROMPT_MAX_LENGTH,
  buildEditorCadenceSummary,
  getPromptStatusLabel,
  normalizeEditorSchedule,
} from "../../_lib/prompt-editor";
import { defaultPromptSchedule } from "../../_lib/utils";
import type { AIModel, ModelVisual, PromptItem, PromptSchedule } from "../../_lib/types";
import {
  PromptCoverageSection,
  PromptTextSection,
} from "./prompt-editor-sections";
import { PromptCadenceSection } from "./prompt-cadence-section";

type PromptEditorPageProps = {
  mode: "create" | "edit";
  prompt: PromptItem | null;
  availableModels: AIModel[];
  getModelVisual: (model: string) => ModelVisual;
  saving: boolean;
  onBack: () => void;
  onSave: (input: {
    text: string;
    modelIds: AIModel[];
    schedule: PromptSchedule;
    status: PromptItem["status"];
  }) => void;
};

export function PromptEditorPage({
  mode,
  prompt,
  availableModels,
  getModelVisual,
  saving,
  onBack,
  onSave,
}: PromptEditorPageProps) {
  const [promptText, setPromptText] = useState("");
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [schedule, setSchedule] = useState<PromptSchedule>(defaultPromptSchedule());
  const [status, setStatus] = useState<PromptItem["status"]>("active");
  const promptModelKey = prompt?.models.join("|") ?? "";

  useEffect(() => {
    const nextModels = prompt?.models.length ? prompt.models : availableModels.slice(0, 1);
    const nextSchedule = normalizeEditorSchedule(prompt?.schedule ?? schedule, nextModels);
    setPromptText(prompt?.prompt ?? "");
    setSelectedModels(nextModels);
    setSchedule(nextSchedule);
    setStatus(prompt?.status ?? "active");
  }, [availableModels, mode, prompt?.id, prompt?.prompt, prompt?.schedule, promptModelKey]);

  useEffect(() => {
    if (availableModels.length === 0) return;
    setSelectedModels((current) => {
      const kept = current.filter((model) => availableModels.includes(model));
      return kept.length > 0 ? kept : availableModels.slice(0, 1);
    });
  }, [availableModels]);

  useEffect(() => {
    setSchedule((current) => normalizeEditorSchedule(current, selectedModels));
  }, [selectedModels]);

  const normalizedSchedule = normalizeEditorSchedule(
    {
      ...schedule,
      modelCrons: schedule.mode === "per_model" ? schedule.modelCrons : {},
    },
    selectedModels,
  );
  const cadenceSummary = buildEditorCadenceSummary(normalizedSchedule);
  const canSave =
    promptText.trim() !== "" &&
    promptText.length <= PROMPT_MAX_LENGTH &&
    selectedModels.length > 0 &&
    !saving;

  return (
    <div className="flex pt-44 h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={mode === "create" ? "Nouveau prompt" : "Modifier le prompt"}
        baseline={
          mode === "create"
            ? "Creez le prompt, definissez la couverture IA et choisissez la cadence d'analyse au meme endroit."
            : "Modifiez le texte du prompt, la couverture IA et la cadence depuis une page dediee."
        }
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="outline">{getPromptStatusLabel(status)}</Badge>
            <Badge variant="outline">{selectedModels.length} IA</Badge>
            <Badge variant="outline">{cadenceSummary.badgeLabel}</Badge>
          </>
        }
        actions={
          <Button type="button" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        }
        className="hidden md:flex pr-4"
      />

      <ScrollArea className="min-h-0 flex-1 pr-4 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
        <div className="space-y-5 overflow-x-hidden pb-6">
          <PromptTextSection
            promptText={promptText}
            maxLength={PROMPT_MAX_LENGTH}
            status={status}
            saving={saving}
            onChangePromptText={setPromptText}
            onChangeStatus={setStatus}
          />
          <PromptCoverageSection
            availableModels={availableModels}
            selectedModels={selectedModels}
            getModelVisual={getModelVisual}
            saving={saving}
            onToggleModel={(model) =>
              setSelectedModels((current) =>
                current.includes(model)
                  ? current.filter((item) => item !== model)
                  : [...current, model],
              )
            }
          />
          <PromptCadenceSection
            schedule={normalizedSchedule}
            saving={saving}
            selectedModels={selectedModels}
            getModelVisual={getModelVisual}
            cadenceModeLabel={cadenceSummary.cadenceModeLabel}
            scheduleLabel={cadenceSummary.scheduleLabel}
            onSetMode={(nextMode) =>
              setSchedule((current) => ({
                ...current,
                mode: nextMode,
                modelCrons: nextMode === "global" ? {} : current.modelCrons,
              }))
            }
            onSetCron={(cron) => setSchedule((current) => ({ ...current, cron }))}
            onSetTimezone={(timezone) => setSchedule((current) => ({ ...current, timezone }))}
            onToggleOverride={(model, enabled) =>
              setSchedule((current) => {
                const nextModelCrons = { ...current.modelCrons };
                if (enabled) {
                  nextModelCrons[model] = nextModelCrons[model] || current.cron;
                } else {
                  delete nextModelCrons[model];
                }
                return {
                  ...current,
                  mode: enabled || Object.keys(nextModelCrons).length > 0 ? "per_model" : current.mode,
                  modelCrons: nextModelCrons,
                };
              })
            }
            onUpdateOverride={(model, cron) =>
              setSchedule((current) => ({
                ...current,
                modelCrons: {
                  ...current.modelCrons,
                  [model]: cron,
                },
              }))
            }
          />
        </div>
      </ScrollArea>

      <div className="border-t px-2 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                text: promptText,
                modelIds: selectedModels,
                schedule: normalizedSchedule,
                status,
              })
            }
          >
            {saving ? "Enregistrement..." : mode === "create" ? "Creer le prompt" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
