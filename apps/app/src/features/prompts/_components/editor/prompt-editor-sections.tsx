"use client";
import { Badge } from "@/components/ui/badge";
import { ModelCard } from "@/components/shared/model-card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  PROMPT_STATUS_OPTIONS,
  getPromptStatusLabel,
} from "../../_lib/prompt-editor";
import type { AIModel, ModelVisual, PromptItem, PromptLanguage } from "../../_lib/types";
import { PromptLanguageIndicator } from "../shared/prompt-language-indicator";

export function PromptTextSection({
  promptText,
  language,
  maxLength,
  status,
  saving,
  onChangePromptText,
  onChangeLanguage,
  onChangeStatus,
}: {
  promptText: string;
  language: PromptLanguage;
  maxLength: number;
  status: PromptItem["status"];
  saving: boolean;
  onChangePromptText: (value: string) => void;
  onChangeLanguage: (value: PromptLanguage) => void;
  onChangeStatus: (value: PromptItem["status"]) => void;
}) {
  const { locale, t } = useScopedI18n("prompts-workspace");

  return (
    <section className="rounded-xl rounded-tr-none bg-background p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium">{t("editorPromptTitle")}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          {promptText.length} / {maxLength}
        </div>
      </div>

      <Textarea
        value={promptText}
        onChange={(event) => onChangePromptText(event.target.value.slice(0, maxLength))}
        maxLength={maxLength}
        placeholder={t("editorPromptPlaceholder")}
        className="mt-4 min-h-[220px] w-full max-w-full resize-y overflow-x-hidden text-sm leading-7 break-all [overflow-wrap:anywhere]"
      />

      <div className="mt-4 space-y-2">
        <Label htmlFor="prompt-language">{t("editorLanguageTitle")}</Label>
        <Select
          value={language}
          onValueChange={(value) => onChangeLanguage(value as PromptLanguage)}
          disabled={saving}
        >
          <SelectTrigger id="prompt-language" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">
              <PromptLanguageIndicator language="fr" label={t("languageFrench")} flagClassName="text-sm" />
            </SelectItem>
            <SelectItem value="en">
              <PromptLanguageIndicator language="en" label={t("languageEnglish")} flagClassName="text-sm" />
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 border-t pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-sm font-medium">{t("editorStatusTitle")}</div>
          <Badge variant="outline">{getPromptStatusLabel(status, locale)}</Badge>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PROMPT_STATUS_OPTIONS.map((option) => {
            const selected = status === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => onChangeStatus(option.value)}
                aria-pressed={selected}
                className={cn(
                  "relative flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                )}
              >
                <div className="absolute right-3 top-3">
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                      selected
                        ? "border-primary bg-primary/80 text-primary"
                        : "border-border bg-background/70 text-muted-foreground",
                    )}
                  />
                </div>
                <div className="pr-5 text-sm font-semibold">
                  {getPromptStatusLabel(option.value, locale)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PromptCoverageSection({
  availableModels,
  selectedModels,
  getModelVisual,
  saving,
  onToggleModel,
}: {
  availableModels: AIModel[];
  selectedModels: AIModel[];
  getModelVisual: (model: string) => ModelVisual;
  saving: boolean;
  onToggleModel: (model: AIModel) => void;
}) {
  const { t } = useScopedI18n("prompts-workspace");

  return (
    <section className="rounded-xl bg-background p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium">{t("editorCoverageTitle")}</div>
        </div>
        <Badge variant="outline">{t("editorCoverageCount", { count: selectedModels.length })}</Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {availableModels.map((model) => {
          const visual = getModelVisual(model);
          const selected = selectedModels.includes(model);

          return (
            <div
              key={model}
              className={cn(saving && "pointer-events-none opacity-70")}
            >
              <ModelCard
                name={visual.name}
                description={visual.label !== visual.name ? visual.label : ""}
                icon={visual.icon}
                selected={selected}
                onClick={() => onToggleModel(model)}
                modelGroup={visual.provider}
                size="medium"
                disabled={saving}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
