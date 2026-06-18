"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/page-header";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  PROMPT_MAX_LENGTH,
  buildEditorCadenceSummary,
  getModelOverrideCron,
  getPromptStatusLabel,
  normalizeEditorSchedule,
  PROMPT_TIMEZONE_OPTIONS,
} from "../../_lib/prompt-editor";
import { defaultPromptSchedule } from "../../_lib/utils";
import type {
  AIModel,
  ModelVisual,
  PromptItem,
  PromptLanguage,
  PromptSchedule,
} from "../../_lib/types";
import {
  PromptCoverageSection,
  PromptTextSection,
} from "./prompt-editor-sections";
import { PromptCadenceSection } from "./prompt-cadence-section";
import { PromptLanguageIndicator } from "../shared/prompt-language-indicator";

type PromptEditorPageProps = {
  mode: "create" | "edit";
  prompt: PromptItem | null;
  availableModels: AIModel[];
  getModelVisual: (model: string) => ModelVisual;
  saving: boolean;
  onBack: () => void;
  onSave: (input: {
    text: string;
    language: PromptLanguage;
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
  const { locale, t } = useScopedI18n("prompts-workspace");
  const [promptText, setPromptText] = useState("");
  const [language, setLanguage] = useState<PromptLanguage>("fr");
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [schedule, setSchedule] = useState<PromptSchedule>(defaultPromptSchedule());
  const [status, setStatus] = useState<PromptItem["status"]>("active");
  const promptModelKey = prompt?.models.join("|") ?? "";

  useEffect(() => {
    const nextModels = prompt?.models.length ? prompt.models : availableModels.slice(0, 1);
    const nextSchedule = normalizeEditorSchedule(prompt?.schedule ?? schedule, nextModels);
    setPromptText(prompt?.prompt ?? "");
    setLanguage(prompt?.language ?? (locale === "en" ? "en" : "fr"));
    setSelectedModels(nextModels);
    setSchedule({
      ...nextSchedule,
      timezone: PROMPT_TIMEZONE_OPTIONS.some((option) => option.value === nextSchedule.timezone)
        ? nextSchedule.timezone
        : "UTC",
    });
    setStatus(prompt?.status ?? "active");
  }, [availableModels, locale, mode, prompt?.id, prompt?.language, prompt?.prompt, prompt?.schedule, promptModelKey]);

  useEffect(() => {
    if (availableModels.length === 0) return;
    setSelectedModels((current) => {
      const kept = current.filter((model) => availableModels.includes(model));
      return kept.length > 0 ? kept : availableModels.slice(0, 1);
    });
  }, [availableModels]);

  const normalizedSchedule = normalizeEditorSchedule(
    {
      ...schedule,
      modelCrons: schedule.mode === "per_model" ? schedule.modelCrons : {},
    },
    selectedModels,
  );
  const cadenceSummary = buildEditorCadenceSummary(normalizedSchedule, locale);
  const canSave =
    promptText.trim() !== "" &&
    promptText.length <= PROMPT_MAX_LENGTH &&
    selectedModels.length > 0 &&
    !saving;

  return (
    <div className="flex pt-44 h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={mode === "create" ? t("editorCreateTitle") : t("editorEditTitle")}
        baseline=""
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="outline">{getPromptStatusLabel(status, locale)}</Badge>
            <Badge variant="outline">
              <PromptLanguageIndicator
                language={language}
                label={language === "en" ? t("languageEnglish") : t("languageFrench")}
                flagClassName="text-sm"
              />
            </Badge>
            <Badge variant="outline">{t("selectedAiCount", { count: selectedModels.length })}</Badge>
            <Badge variant="outline">{cadenceSummary.badgeLabel}</Badge>
          </>
        }
        actions={
          <Button type="button" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
        }
        className="hidden md:flex pr-4"
      />

      <ScrollArea className="min-h-0 flex-1 pr-4 pt-0">
        <div className="space-y-5 overflow-x-hidden pb-6">
          <PromptTextSection
            promptText={promptText}
            language={language}
            maxLength={PROMPT_MAX_LENGTH}
            status={status}
            saving={saving}
            onChangePromptText={setPromptText}
            onChangeLanguage={setLanguage}
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
                  nextModelCrons[model] =
                    getModelOverrideCron(current.cron, nextModelCrons[model]);
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
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                text: promptText,
                language,
                modelIds: selectedModels,
                schedule: normalizedSchedule,
                status,
              })
            }
          >
            {saving ? t("saving") : mode === "create" ? t("createPrompt") : t("savePrompt")}
          </Button>
        </div>
      </div>
    </div>
  );
}
